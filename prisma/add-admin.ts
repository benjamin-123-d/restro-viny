import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { hashPin } from "../src/lib/pin";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PHONE = "+2290162702152";
const PIN = "1234";

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { phone: PHONE },
    update: {
      role: "ADMIN",
      isActive: true,
      pinHash: hashPin(PIN),
      pinUpdatedAt: new Date(),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      phoneVerifiedAt: new Date(),
    },
    create: {
      name: "Benjamin",
      phone: PHONE,
      role: "ADMIN",
      isActive: true,
      pinHash: hashPin(PIN),
      pinUpdatedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });

  console.log(`OK -> ${user.name} | ${user.phone} | role ${user.role} | id ${user.id}`);
  console.log(`PIN de connexion : ${PIN}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
