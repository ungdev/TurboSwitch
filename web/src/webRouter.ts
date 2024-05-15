import { NextFunction, Request, Response, Router } from "express";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import {
  authenticate,
  generateCode,
  generateNewCode,
  getJoyconsLeft,
  getLastTimeChestWasAlive,
  getWaitingOpening,
  getWaitingOpeningWithValidCode,
} from "./utils";

const webRouter = Router();

webRouter.use(
  async (request: Request, response: Response, next: NextFunction) => {
    // route /down
    const chestAlive =
      Date.now() - getLastTimeChestWasAlive() <
      Number.parseInt(process.env.TIME_BEFORE_CHEST_DEATH) * 1000;
    if (!request.url.startsWith("/down") && !chestAlive) {
      return response.redirect("/down");
    }
    if (request.url.startsWith("/down") && chestAlive) {
      return response.redirect("/");
    }
    if (request.url.startsWith("/down") && !chestAlive) {
      return next();
    }
    // route /login
    const login = authenticate(request);
    if (!request.url.startsWith("/login") && !login) {
      return response.redirect("/login");
    }
    if (request.url.startsWith("/login") && login) {
      return response.redirect("/");
    }
    if (request.url.startsWith("/login") && !login) {
      return next();
    }
    // route /borrow
    const opening = await getWaitingOpening(login);
    if (!request.url.startsWith("/borrow") && !opening) {
      return response.redirect("/borrow");
    }
    if (request.url === "/borrow" && opening) {
      return response.redirect("/");
    }
    if (request.url.startsWith("/borrow") && !opening) {
      return next();
    }
    // route /code
    if (!request.url.startsWith("/code") && opening) {
      return response.redirect("/code");
    }
    if (request.url.startsWith("/code") && !opening) {
      return response.redirect("/");
    }
    if (request.url.startsWith("/code") && opening) {
      return next();
    }
    return next();
  }
);

webRouter.get("/borrow", async (request: Request, response: Response) => {
  if (!request.query["joyconsLeft"]) {
    return response.redirect(`/borrow/?joyconsLeft=${await getJoyconsLeft()}`);
  }
  return response.sendFile(path.join(__dirname, "../www/borrow.html"));
});

webRouter.get("/code", async (request: Request, response: Response) => {
  const login = authenticate(request);
  const opening = await getWaitingOpening(login);
  if (
    !request.query["code"] ||
    !request.query["joycons"] ||
    !request.query["type"] ||
    !(await getWaitingOpeningWithValidCode(login))
  ) {
    const newCode = await generateNewCode(opening.id);
    return response.redirect(
      `/code/?code=${newCode}&joycons=${opening.borrow.joyconsTaken}&type=${opening.type}`
    );
  }
  return response.sendFile(path.join(__dirname, "../www/getCode.html"));
});

webRouter.get("/login", async (request: Request, response: Response) => {
  if (!request.query["ticket"]) {
    return response.sendFile(path.join(__dirname, "../www/login.html"));
  }
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
    return response.redirect("/login");
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
});

webRouter.get("/login/cas", async (request: Request, response: Response) => {
  return response.redirect(
    `https://cas.utt.fr/cas/login?service=${encodeURI(process.env.CAS_SERVICE)}`
  );
});

webRouter.post("/borrow", async (request: Request, response: Response) => {
  const login = authenticate(request);
  if (await getWaitingOpening(login)) return response.redirect("/code");
  if (!request.body.joycons) return response.redirect("/borrow");
  const joycons = Number.parseInt(request.body.joycons);
  if (Number.isNaN(joycons)) {
    return response.redirect("/borrow");
  }
  const joyconsLeft = await getJoyconsLeft();
  if (joycons < 0 || joycons > joyconsLeft) {
    return response.redirect("/borrow");
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
  return response.redirect(`/code/?code=${code}`);
});

webRouter.get("/down", async (request: Request, response: Response) => {
  response.sendFile(path.join(__dirname, "../www/down.html"));
});

webRouter.get('/legal', async (request: Request, response: Response) => {
  return response.sendFile(path.join(__dirname, "../www/legal.html"));
})

webRouter.use(async (request: Request, response: Response) => {
  return response.redirect("/");
});

export default webRouter;
