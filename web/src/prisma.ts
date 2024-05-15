import {PrismaClient} from "@prisma/client";

export const prisma = new PrismaClient();

const validOpening = {
  codeGeneratedAt: { gte: new Date(Date.now() - 1000 * 60 * 5) },
  date: null,
}

const currentlyBorrowing = {
  borrowOpening: { date: { not: null } },
  returnOpening: { date: null },
}

export const prismaUtils = {
  validOpening,
  currentlyBorrowing,
};
