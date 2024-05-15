import { Request, Response, Router } from "express";
import { prisma } from "./prisma";
import logger from "./logger";
import { CODE_LIFETIME, generateCode, setLastTimeChestWasAlive } from "./utils";

const apiRouter = Router();

apiRouter.use((request: Request, response: Response, next) => {
  if (!request.headers['authorization'] || request.headers['authorization'] !== `Bearer ${process.env.API_KEY}`) {
    return response.status(403).send("Invalid API Key");
  }
  return next();
});

apiRouter.post("/api/sesame", async (request: Request, response: Response) => {
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
      codeGeneratedAt: new Date(Date.now() - CODE_LIFETIME),
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

apiRouter.get("/ping", async (request: Request, response: Response) => {
  setLastTimeChestWasAlive(Date.now());
  return response.status(200).send("Good news ! (Me too)");
});

apiRouter.use(async (request: Request, response: Response) => {
  return response.status(404).send("captain l'url làààààà");
});

export default apiRouter;
