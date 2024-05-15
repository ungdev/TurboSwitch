import { Request, Response, Router } from "express";
import { prisma } from "./prisma";
import logger from "./logger";
import { CODE_LIFETIME, generateCode, setLastTimeChestWasAlive } from "./utils";

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
    logger.info(`Generating reports for ${borrows.length} users !`);
    const count = borrows.reduce((acc, borrow) => acc + borrow.joyconsTaken, 0);
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify({
        content: null,
        embeds: [
          {
            title: "⚠️ Emprunts non rendus",
            description: `🚨 ${count} joycon${count > 1 ? "s" : ""} n'${
              count > 1 ? "ont" : "a"
            } pas été rendu${count > 1 ? "s" : ""} !`,
            color: 11468800,
            fields: borrows.map((borrow) => ({
              name: `[${borrow.user.firstName} ${
                borrow.user.lastName
              }](mailto:${
                borrow.user.mail
              }?subject=Joycons%20non%20rendus&cc=ung@utt.fr&body=Coucou%20${borrow.user.firstName.replace(
                /\s/g,
                "%20"
              )},%0D%0A%0D%0AIl%20semblerait%20que%20tu%20ne%20nous%20a%20pas%20rendu%20les%20joycons%20que%20tu%20as%20empruntés%20aujourd'hui.%0D%0AMerci%20de%20les%20rendre%20au%20plus%20vite.%0D%0A%0D%0ACordialement`,
              value: `${borrow.joyconsTaken} joycon${
                borrow.joyconsTaken > 1 ? "s" : ""
              } non rendu(s)`,
            })),
            timestamp: new Date().toISOString(),
          },
        ],
        attachments: [],
      }),
    });
  }
  return response.status(200).send("Generating reports");
});

apiRouter.use(async (request: Request, response: Response) => {
  return response.status(404).send("captain l'url làààààà");
});

export default apiRouter;
