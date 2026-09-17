import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });
prisma.accountingPiece.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } })
  .then((p) => { console.log(p?.id ?? "aucune"); return prisma.$disconnect(); });
