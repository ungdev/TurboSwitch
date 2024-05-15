import {Request, Response, Router} from "express";
import path from "path";
import {XMLParser} from "fast-xml-parser";
import jwt from "jsonwebtoken";
import {prisma, prismaUtils} from "./prisma";
import {authenticate, generateCode, getJoyconsLeft} from "./utils";

const webRouter = Router();

webRouter.get("/", async (request: Request, response: Response) => {
  const login = authenticate(request);
  if (!login) {
    return response.redirect("/login");
  }
  if (request.query['code']) {
    return response.sendFile(path.join(__dirname, '../www/getCode.html'));
  }
  const borrow = await prisma.borrow.findFirst({
    where: { user: { login }, ...prismaUtils.currentlyBorrowing },
  });
  if (!borrow) {
    return response.sendFile(path.join(__dirname, "../www/borrow.html"));
  }
  const code = await generateCode();
  await prisma.borrow.update({where: {id: borrow.id}, data: {returnOpening: {upsert: {create: {code, codeGeneratedAt: new Date(Date.now())}, update: {code, codeGeneratedAt: new Date(Date.now())}}}}});
  return response.redirect(`/?code=${code}`);
});

webRouter.get("/login", async (request: Request, response: Response) => {
  if (authenticate(request)) {
    return response.redirect("/");
  }
  if (request.query["ticket"]) {
    const res = await fetch(
      `https://cas.utt.fr/cas/serviceValidate?service=${encodeURI(
        process.env.CAS_SERVICE
      )}&ticket=${request.query["ticket"]}`
    );
    const resData: {
      ["cas:serviceResponse"]:
        | {
        ["cas:authenticationSuccess"]: {
          ["cas:attributes"]: {
            "cas:uid": string;
            "cas:mail": string;
            "cas:sn": string;
            "cas:givenName": string;
          };
        };
      }
        | { "cas:authenticationFailure": unknown };
    } = new XMLParser().parse(await res.text());
    if ("cas:authenticationFailure" in resData["cas:serviceResponse"]) {
      return { status: "invalid", token: "" };
    }
    const userData = {
      login:
        resData["cas:serviceResponse"]["cas:authenticationSuccess"][
          "cas:attributes"
          ]["cas:uid"],
      mail: resData["cas:serviceResponse"]["cas:authenticationSuccess"][
        "cas:attributes"
        ]["cas:mail"],
      lastName:
        resData["cas:serviceResponse"]["cas:authenticationSuccess"][
          "cas:attributes"
          ]["cas:sn"],
      firstName:
        resData["cas:serviceResponse"]["cas:authenticationSuccess"][
          "cas:attributes"
          ]["cas:givenName"],
    };
    let user = await prisma.user.findUnique({
      where: { login: userData.login },
    });
    if (!user) {
      await prisma.user.create({ data: userData });
    }
    const token = jwt.sign({ login: userData.login }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
    return response.cookie("token", token).redirect("/");
  }
  return response.sendFile(path.join(__dirname, "../www/login.html"));
});

webRouter.get("/login/cas", async (request: Request, response: Response) => {
  return response.redirect(
    `https://cas.utt.fr/cas/login?service=${encodeURI(process.env.CAS_SERVICE)}`
  );
});

webRouter.post("/", async (request: Request, response: Response) => {
  const login = authenticate(request);
  if (!login) {
    return response.redirect("/login");
  }
  const joycons = Number.parseInt(request.body.joycons);
  const joyconsLeft = await getJoyconsLeft();
  if (joycons < 0 || joycons > joyconsLeft) {
    return response.send(
      `Il ne reste plus que ${joyconsLeft} joycons disponibles`
    );
  }
  const code = await generateCode();
  await prisma.borrow.create({
    data: {
      joyconsTaken: joycons,
      borrowOpening: {
        create: {
          code,
          codeGeneratedAt: new Date(),
        },
      },
      returnOpening: { create: {} },
      user: { connect: { login } },
    },
  });
  return response.redirect(`/?code=${code}`);
});

export default webRouter;
