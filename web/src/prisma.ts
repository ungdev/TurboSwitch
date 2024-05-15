import { PrismaClient } from "@prisma/client";
import { CODE_LIFETIME } from "./utils";

export const prisma = new PrismaClient();

const validOpening = {
  codeGeneratedAt: { gte: new Date(Date.now() - CODE_LIFETIME) },
  date: null,
};

const currentlyBorrowing = {
  borrowOpening: { date: { not: null } },
  returnOpening: { date: null },
};

export const prismaUtils = {
  validOpening,
  currentlyBorrowing,
};
