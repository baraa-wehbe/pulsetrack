import "dotenv/config";

import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env.mjs";
import { createActiveClinician } from "@/server/auth/create-clinician";

const BASE_URL = "http://localhost:3000";
const nextBinary = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const tsxBinary = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const email = `task07-e2e-${randomBytes(12).toString("hex")}@example.test`;
const password = `T7!${randomBytes(32).toString("base64url")}`;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const waitForServer = async (server) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error("The production server exited before becoming ready.");
    }

    try {
      const response = await fetch(`${BASE_URL}/login`);
      if (response.ok) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("The production server did not become ready.");
};

const runVerification = async ({ file, label }, environment) => {
  const child = spawn(
    process.execPath,
    [tsxBinary, "--tsconfig", "jsconfig.json", file],
    {
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const [exitCode] = await once(child, "exit");

  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}.`);
  }
};

const main = async () => {
  let clinicianId;
  let server;

  try {
    const clinician = await createActiveClinician(prisma, {
      email,
      password,
      fullName: "Task 07 Verification Clinician",
    });
    clinicianId = clinician.id;

    server = spawn(process.execPath, [nextBinary, "start"], {
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    await waitForServer(server);

    const environment = {
      ...process.env,
      PULSETRACK_E2E_EMAIL: email,
      PULSETRACK_E2E_PASSWORD: password,
    };

    for (const verification of [
      {
        label: "Patient HTTP verification",
        file: "scripts/verify-patient-flow.js",
      },
      {
        label: "Patient browser verification",
        file: "scripts/verify-patient-browser.js",
      },
      {
        label: "Shell HTTP verification",
        file: "scripts/verify-shell-flow.js",
      },
      {
        label: "Shell browser verification",
        file: "scripts/verify-shell-browser.js",
      },
    ]) {
      await runVerification(verification, environment);
    }

    console.log(
      "Patient HTTP, browser, RTL, theme, responsive, and accessibility verification passed.",
    );
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
      if (server.exitCode === null) {
        await Promise.race([
          once(server, "exit").catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 2_000)),
        ]);
      }
    }

    if (clinicianId) {
      await prisma.clinicianSession.deleteMany({ where: { clinicianId } });
      await prisma.clinician.delete({ where: { id: clinicianId } });
    }

    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Verification failed.",
  );
  process.exitCode = 1;
});
