import {Request} from "express";
import jwt from "jsonwebtoken";
import {prisma, prismaUtils} from "./prisma";

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
