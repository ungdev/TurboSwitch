import { Request } from "express";
import jwt from "jsonwebtoken";
import { prisma, prismaUtils } from "./prisma";
import { Prisma } from "@prisma/client";

export type DiscordEmbed = {
  title: string;
  description: string;
  color: number;
  fields: {
    name: string;
    value: string;
  }[];
  timestamp: Date;
};

export function authenticate(request: Request) {
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

export async function generateCode() {
  let code: string;
  let found;
  const ciffers = "0123456789";
  do {
    code =
      ciffers[Math.floor(Math.random() * 10)] +
      ciffers[Math.floor(Math.random() * 10)] +
      ciffers[Math.floor(Math.random() * 10)] +
      ciffers[Math.floor(Math.random() * 10)];
    found = await prisma.opening.findFirst({ where: { code, date: null } });
  } while (found);
  return code;
}

export async function getJoyconsLeft() {
  const joyconBorrows = await prisma.borrow.findMany({
    where: {
      OR: [
        { createdAt: { gte: new Date(Date.now() - BORROW_TIMEOUT) } },
        { borrowOpening: { date: { not: null } } },
      ],
      returnOpening: { date: null },
      borrowOpening: { code: { not: null } },
    },
  });
  return (
    Number.parseInt(process.env.TOTAL_JOYCONS) -
    joyconBorrows.reduce((acc, borrow) => acc + borrow.joyconsTaken, 0)
  );
}

export const OPENING_INCLUDE_BEFORE_FORMATTING = {
  include: {
    borrow: true,
    return: true,
  },
} as const;

type FormattedOpening = Omit<
  Prisma.OpeningGetPayload<typeof OPENING_INCLUDE_BEFORE_FORMATTING>,
  "return"
> & { type: "borrow" | "return" };

export function formatOpening(
  opening: Prisma.OpeningGetPayload<typeof OPENING_INCLUDE_BEFORE_FORMATTING>
): FormattedOpening {
  if (!opening) {
    return null;
  }
  if (opening.return) {
    opening.borrow = opening.return;
    delete opening.return;
    return { ...opening, type: "return" };
  }
  delete opening.return;
  return { ...opening, type: "borrow" };
}

export async function getWaitingOpening(userLogin: string) {
  const opening = await prisma.opening.findFirst({
    where: {
      date: null,
      code: { not: null },
      AND: [
        {
          OR: [{ borrow: { userLogin } }, { return: { userLogin } }],
        },
        {
          OR: [
            {
              borrow: null,
            },
            {
              borrow: {
                createdAt: { gte: new Date(Date.now() - BORROW_TIMEOUT) },
              },
            },
          ],
        },
      ],
    },
    ...OPENING_INCLUDE_BEFORE_FORMATTING,
  });
  return formatOpening(opening);
}

export async function getWaitingOpeningWithValidCode(userLogin: string) {
  const opening = await prisma.opening.findFirst({
    where: {
      ...prismaUtils.validOpening,
      AND: [
        {
          OR: [{ borrow: { userLogin } }, { return: { userLogin } }],
        },
        {
          OR: [
            {
              borrow: null,
            },
            {
              borrow: {
                createdAt: { gte: new Date(Date.now() - BORROW_TIMEOUT) },
              },
            },
          ],
        },
      ],
    },
    ...OPENING_INCLUDE_BEFORE_FORMATTING,
  });
  return formatOpening(opening);
}

export async function generateNewCode(borrowId: number) {
  const code = await generateCode();
  await prisma.opening.update({
    where: { id: borrowId },
    data: {
      code,
      codeGeneratedAt: new Date(Date.now()),
    },
  });
  return code;
}

export function sendDiscordWebhook(embeds: DiscordEmbed[]) {
  return fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: null,
      embeds: embeds.map((embed) => ({
        ...embed,
        timestamp: embed.timestamp.toISOString(),
      })),
      attachments: [],
    }),
  });
}

let lastTimeChestWasAlive = 0;
let sendInterval = Number.parseInt(process.env.TIME_BEFORE_CHEST_DEATH) * 1000;
let lastChestAlive = false;

function checkChestAlive() {
  if (chestAlive() !== lastChestAlive) {
    lastChestAlive = !lastChestAlive;
    if (lastChestAlive) {
      // Chest is up
      sendDiscordWebhook([
        {
          title: "✅ Le coffre est de nouveau en ligne",
          color: 2985934,
          description: "*Niceeeeuuuhh* 🎉🎉🎉",
          fields: [],
          timestamp: new Date(),
        },
      ]);
    } else {
      // Chest is down
      sendDiscordWebhook([
        {
          title: "⚠️ Le coffre est hors ligne !",
          color: 16711680,
          description:
            "*<@&1209413150424825876> vérifiez l'état du coffre et des piles !*",
          fields: [],
          timestamp: new Date(),
        },
      ]);
    }
  }
}

export function setLastTimeChestWasAlive(time: number, sendInSecs?: number) {
  lastTimeChestWasAlive = time;
  sendInterval =
    ((sendInSecs || Number.parseInt(process.env.TIME_BEFORE_CHEST_DEATH)) + 2) *
    1000;
  setTimeout(checkChestAlive, sendInterval);
}

export function chestAlive() {
  return (
    process.env.CHEST_ALWAYS_ALIVE === "true" ||
    Date.now() - lastTimeChestWasAlive < sendInterval
  );
}

export const CODE_LIFETIME = Number(process.env.CODE_LIFETIME) * 1000;
export const BORROW_TIMEOUT = Number(process.env.BORROW_TIMEOUT) * 1000;
