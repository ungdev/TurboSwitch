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
} from "./utils";

const webRouter = Router();

function chestAlive() {
  return Date.now() - getLastTimeChestWasAlive() < Number.parseInt(process.env.TIME_BEFORE_CHEST_DEATH) * 1000;
}

webRouter.get("/borrow", async (request: Request, response: Response) => {
  if (!chestAlive()) return response.redirect('/down');
  const login = authenticate(request);
  if (!authenticate(request)) return response.redirect('/login');
  if (await getWaitingOpening(login)) return response.redirect('/code');
  const joyconsLeft = await getJoyconsLeft();
  return response.render(path.join(__dirname, '../www/borrow.html'), { joyconsLeft });
});

webRouter.get("/code", async (request: Request, response: Response) => {
  const login = authenticate(request);
  if (!login) return response.redirect('/login');
  if (!chestAlive()) return response.redirect('/down');
  if (!await getWaitingOpening(login)) return response.redirect('/');
  const opening = await getWaitingOpening(login);
  const newCode = await generateNewCode(opening.id);
  return response.render(path.join(__dirname, "../www/getCode.html"), { code: newCode, joycons: opening.borrow.joyconsTaken, type: opening.type });
});

webRouter.get("/login", async (request: Request, response: Response) => {
  if (!chestAlive()) return response.redirect('/down');
  if (authenticate(request)) return response.redirect('/');
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

webRouter.get('/logout', async (request: Request, response: Response) => {
  return response.clearCookie('token').redirect('/');
});

webRouter.post("/borrow", async (request: Request, response: Response) => {
  const login = authenticate(request);
  if (!login) return response.redirect('/login');
  if (!chestAlive()) return response.redirect('/down');
  if (await getWaitingOpening(login)) return response.redirect('/code');
  if (!request.body.joycons) return response.redirect('/borrow');
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
  return response.redirect('/code');
});

webRouter.get('/forceOpen', async (request: Request, response: Response) => {
  if (!chestAlive()) return response.redirect('/down');
  if (!request.query.id) return response.redirect('/');
  if (!authenticate(request)) return response.redirect('/login');
  const alreadyOpened = await prisma.opening.count({
    where: { id: Number.parseInt(request.query.id as string), date: null },
  }) == 0;
  if (alreadyOpened) {
    return response.redirect('/');
  }
  const newCode = generateNewCode(Number.parseInt(request.query.id as string));
  response.render(path.join(__dirname, '../www/code.html'), { code: newCode });
});

webRouter.get("/down", async (request: Request, response: Response) => {
  if (chestAlive()) return response.redirect('/');
  response.sendFile(path.join(__dirname, "../www/down.html"));
});

webRouter.get('/legal', async (request: Request, response: Response) => {
  return response.sendFile(path.join(__dirname, "../www/legal.html"));
});

webRouter.get('/', async (request: Request, response: Response) => {
  if (!chestAlive()) return response.redirect('/down');
  const login = authenticate(request);
  if (!login) return response.redirect('/login');
  if (await getWaitingOpening(login)) return response.redirect('/code');
  return response.redirect('/borrow');
});

webRouter.use(async (request: Request, response: Response) => {
  return response.redirect("/");
});

export default webRouter;
