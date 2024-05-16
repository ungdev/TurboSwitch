import { Request, Response, Router } from "express";
import { prisma } from "./prisma";
import logger from "./logger";
import {
  CODE_LIFETIME,
  generateNewCode,
  sendDiscordWebhook,
  setLastTimeChestWasAlive,
} from "./utils";

const apiRouter = Router();

apiRouter.use((request: Request, response: Response, next) => {
  if (
    !request.headers["authorization"] ||
    request.headers["authorization"] !== `Bearer ${process.env.API_KEY}`
  ) {
    return response.status(403).send("Invalid API Key");
  }
  return next();
});

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
      codeGeneratedAt: { gte: new Date(Date.now() - CODE_LIFETIME) },
    },
    select: {
      id: true,
      borrow: {
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

  await prisma.opening.update({
    where: {
      id: opening.id,
    },
    data: {
      date: new Date(),
    },
  });

  if (opening.borrow) await generateNewCode(opening.borrow.returnOpeningId);

  logger.info(`Opening chest with code ${sesame} for opening ${opening.id}`);
  return response.status(200).send("Sésame ouvre toi");
});

apiRouter.get("/ping", async (request: Request, response: Response) => {
  const interval: number = Number(request.body.interval) || undefined;
  setLastTimeChestWasAlive(Date.now(), interval);
  logger.info("Chest pinged");
  return response.status(200).send("Good news ! (Me too)");
});

apiRouter.get("/reports", async (request: Request, response: Response) => {
  const borrows = await prisma.borrow.findMany({
    where: {
      returnOpening: {
        date: null,
      },
    },
    include: {
      user: true,
    },
  });
  if (borrows.length) {
    logger.info(`Generating reports for ${borrows.length} users`);
    const count = borrows.reduce((acc, borrow) => acc + borrow.joyconsTaken, 0);
    sendDiscordWebhook([
      {
        title: "⚠️ Emprunts non rendus",
        description: `🚨 ${count} joycon${count > 1 ? "s" : ""} n'${
          count > 1 ? "ont" : "a"
        } pas été rendu${count > 1 ? "s" : ""} !`,
        color: 11468800,
        fields: borrows.map((borrow) => ({
          name: `${borrow.user.firstName} ${borrow.user.lastName}`,
          value: `${borrow.joyconsTaken} joycon${
            borrow.joyconsTaken > 1 ? "s" : ""
          } non rendu(s)\nContacte le : ${
            borrow.user.mail
          }\n[Génère un nouveau code de retour](https://turboswitch.assos.utt.fr/forceOpen?id=${
            borrow.returnOpeningId
          })`,
        })),
        timestamp: new Date(),
      },
    ]);
  }
  return response.status(200).send("Generating reports");
});

apiRouter.use(async (request: Request, response: Response) => {
  logger.warning(`Invalid API route : ${request}. This should never happen, verify token is not compromised and chest is working properly`)
  return response.status(404).send("captain l'url làààààà");
});

export default apiRouter;
