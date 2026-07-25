import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { env } from "../src/config/env.mjs";
import { seedDatabase } from "./seed.js";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

const main = async () => {
  try {
    await seedDatabase(prisma);
    console.log("PulseTrack reference data seed completed.");
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
});
