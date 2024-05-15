import {Request} from "express";
import jwt from "jsonwebtoken";
import {prisma, prismaUtils} from "./prisma";
import { Prisma } from "@prisma/client";

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
    found = await prisma.opening.findFirst({ where: { code } });
  } while (found);
  return code;
}

export async function getJoyconsLeft() {
  const joyconBorrows = await prisma.borrow.findMany({where: {borrowOpening: {OR: [prismaUtils.validOpening, {date: {not: null}}]}, returnOpening: {date: {not: null}}}});
  return Number.parseInt(process.env.TOTAL_JOYCONS) - joyconBorrows.reduce((acc, borrow) => acc + borrow.joyconsTaken, 0);
}

const OPENING_INCLUDE_BEFORE_FORMATTING = {
  include: {
    borrow: true,
    return: true,
  },
} as const;

type FormattedOpening = Omit<Prisma.OpeningGetPayload<typeof OPENING_INCLUDE_BEFORE_FORMATTING>, 'return'> & {type: 'borrow' | 'return'}

export function formatOpening(opening: Prisma.OpeningGetPayload<typeof OPENING_INCLUDE_BEFORE_FORMATTING>): FormattedOpening {
  if (!opening) {
    return null;
  }
  if (opening.return) {
    opening.borrow = opening.return;
    delete opening.return;
    return {...opening, type: 'return'};
  }
  delete opening.return;
  return {...opening, type: 'borrow'};
}

export async function getWaitingOpening(userLogin: string) {
  const opening = await prisma.opening.findFirst({
    where: {
      date: null,
      code: { not: null },
      OR: [
        { borrow: { userLogin } },
        { return: { userLogin } },
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
      OR: [
        { borrow: { userLogin } },
        { return: { userLogin } }
      ]
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

let lastTimeChestWasAlive = 0;
export function setLastTimeChestWasAlive(time: number) {
  lastTimeChestWasAlive = time;
}
export function getLastTimeChestWasAlive() {
  return Date.now();//lastTimeChestWasAlive;
}
