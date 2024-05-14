import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import path from "path";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { XMLParser } from "fast-xml-parser";
import bodyParser from "body-parser";
import logger from "./logger";
import * as Sentry from "@sentry/node";

const prisma = new PrismaClient();
dotenv.config();
const app = express();

const webRouter = Router();

function authenticate(request: Request) {
  if (!request.cookies["token"]) {
    return null;
  }
  try {
    return (
      jwt.verify(request.cookies["token"], process.env.JWT_SECRET) as {
        login: string;
      }
    ).login;
  } catch (e) {
    return null;
  }
}

const validOpening = {
  codeGeneratedAt: { gte: new Date(Date.now() - 1000 * 60 * 5) },
};

const currentlyBorrowing = {
  borrowOpening: { date: { not: null } },
  returnOpening: { date: null },
};

async function generateCode() {
  let code: string;
  let found;
  const ciffers = "0123456789";
  do {
    code =
      ciffers[Math.floor(Math.random() * 10)] +
      ciffers[Math.floor(Math.random() * 10)] +
      ciffers[Math.floor(Math.random() * 10)] +
      ciffers[Math.floor(Math.random() * 10)];
    found = await prisma.opening.findFirst({ where: { code } });
  } while (found);
  return code;
}

async function getJoyconsLeft() {
  const joyconBorrows = await prisma.borrow.findMany({
    where: {
      borrowOpening: { OR: [validOpening, { date: { not: null } }] },
      returnOpening: { date: { gte: new Date(Date.now()) } },
    },
  });
  return (
    Number.parseInt(process.env.TOTAL_JOYCONS) -
    joyconBorrows.reduce((acc, borrow) => acc + borrow.joyconsTaken, 0)
  );
}

webRouter.get("/", async (request: Request, response: Response) => {
  const login = authenticate(request);
  if (!login) {
    return response.redirect("/login");
  }
  const borrow = await prisma.borrow.findFirst({
    where: { user: { login }, ...currentlyBorrowing },
  });
  if (!borrow) {
    return response.sendFile(path.join(__dirname, "../www/borrow.html"));
  }
  if (request.query["code"]) {
    return response.sendFile(path.join(__dirname, "../www/giveBack.html"));
  }
  const code = await generateCode();
  await prisma.opening.upsert({
    where: { id: borrow.id },
    create: { code, codeGeneratedAt: new Date(Date.now()) },
    update: { code, codeGeneratedAt: new Date(Date.now()) },
  });
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
      // TODO : fetch other infos from LDAP
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

const apiRouter = Router();

apiRouter.post("/sesame", async (request: Request, response: Response) => {
  const sesame: string | undefined = request.body.code;
  if (!sesame) return response.status(400).send("Missing code");
  if (
    typeof sesame !== "string" ||
    sesame.length !== (Number(process.env.SESAME_LENGTH) || 4)
  )
    return response.status(400).send("Invalid code");

  const [opening] = await prisma.opening.findMany({
    where: {
      code: sesame,
      date: null,
      codeGeneratedAt: new Date(Date.now() - 1000 * 60 * 5),
    },
    select: {
      return: {
        select: {
          returnOpeningId: true,
        },
      },
    },
  });

  if (!opening) {
    logger.info(`Invalid Sesame provided : ${sesame}`);
    return response.status(403).send("Invalid sesame");
  }

  if (opening.return) {
    const returnCode = await generateCode();
    await prisma.opening.update({
      where: {
        id: opening.return.returnOpeningId,
      },
      data: {
        code: returnCode,
        codeGeneratedAt: new Date(),
      },
    });
  }

  return response.status(200).send("Sésame ouvre toi");
});

if (process.env.SENTRY_DSN) {
  // Initiate Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });
  Sentry.setupExpressErrorHandler(app);
}

// Enable morgan logger
// app.use(morgan());

// Enable compression
// app.use(compression());

// Security middlewares
// app.use(cors(), helmet());

app.use("", cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("", webRouter);

// Main routes
app.use(process.env.API_PREFIX, apiRouter);

// Not found
// app.use((request: Request, response: Response) => notFound(response, Error.RouteNotFound));

// Error Handles
// app.use(errorHandler);

export default app;
