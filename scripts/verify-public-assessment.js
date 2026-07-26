import "dotenv/config";

import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";

const BASE_URL = "http://localhost:3000";
const nextBinary = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const tsxBinary = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const email = `public-assessment-browser-${randomBytes(12).toString("hex")}@example.test`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const waitForServer = async (server) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error("The production server exited before becoming ready.");
    }
    try {
      const response = await fetch(`${BASE_URL}/assessment`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The production server did not become ready.");
};

const main = async () => {
  let clinicianId;
  let server;

  try {
    const clinician = await prisma.clinician.create({
      data: {
        email,
        fullName: "Public Assessment Browser Clinician",
        passwordHash: "browser-test-hash-not-a-credential",
        status: "ACTIVE",
      },
    });
    clinicianId = clinician.id;

    server = spawn(process.execPath, [nextBinary, "start"], {
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    await waitForServer(server);

    const child = spawn(
      process.execPath,
      [
        tsxBinary,
        "--tsconfig",
        "jsconfig.json",
        "scripts/verify-public-assessment-browser.js",
      ],
      {
        env: { ...process.env, PULSETRACK_E2E_EMAIL: email },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    const [exitCode] = await once(child, "exit");
    if (exitCode !== 0) {
      throw new Error("Public assessment browser verification failed.");
    }
  } finally {
    if (server && server.exitCode === null) {
      if (process.platform === "win32") {
        spawnSync("taskkill.exe", ["/pid", String(server.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        server.kill();
      }
    }
    if (clinicianId) {
      await prisma.clinician.deleteMany({ where: { id: clinicianId } });
    }
    await prisma.$disconnect();
  }
};

main().catch(() => {
  console.error("Public assessment browser orchestration failed.");
  process.exitCode = 1;
});
