import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

export const STARTUP_STEPS = Object.freeze([
  {
    label: "Validate Prisma schema",
    executable: process.execPath,
    arguments: ["node_modules/prisma/build/index.js", "validate"],
  },
  {
    label: "Generate Prisma Client",
    executable: process.execPath,
    arguments: ["node_modules/prisma/build/index.js", "generate"],
  },
  {
    label: "Deploy pending database migrations",
    executable: process.execPath,
    arguments: ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  },
  {
    label: "Seed reference data",
    executable: process.execPath,
    arguments: ["node_modules/prisma/build/index.js", "db", "seed"],
  },
  {
    label: "Provision startup clinician",
    executable: process.execPath,
    arguments: [
      "node_modules/tsx/dist/cli.mjs",
      "--tsconfig",
      "jsconfig.json",
      "scripts/provision-startup-clinician.js",
    ],
  },
]);

export const NEXT_BUILD_STEP = Object.freeze({
  label: "Build Next.js application",
  executable: process.execPath,
  arguments: ["node_modules/next/dist/bin/next", "build"],
});

export const NEXT_START_STEP = Object.freeze({
  label: "Start Next.js production server",
  executable: process.execPath,
  arguments: ["node_modules/next/dist/bin/next", "start"],
});

export const DEVELOPMENT_SERVER_STEP = Object.freeze({
  label: "Start development web and scheduler processes",
  executable: process.execPath,
  arguments: [
    "node_modules/concurrently/dist/bin/concurrently.js",
    "--kill-others-on-fail",
    "--names",
    "web,scheduler",
    "npm:dev:web",
    "npm:dev:scheduler",
  ],
});

export const executeStartupStep = (step) =>
  spawnSync(step.executable, step.arguments, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

export const runStartupBootstrap = (
  steps = STARTUP_STEPS,
  execute = executeStartupStep,
) => {
  console.log("[startup] Preparing PulseTrack database.");

  for (const step of steps) {
    console.log(`[startup] ${step.label}...`);
    const result = execute(step);

    if (result.error || result.status !== 0) {
      throw new Error(`${step.label} failed.`);
    }
  }

  console.log("[startup] PulseTrack preparation completed.");
};

export const runApplicationStep = (
  step,
  additionalArguments = [],
  execute = executeStartupStep,
) => {
  const resolvedStep = {
    ...step,
    arguments: [...step.arguments, ...additionalArguments],
  };
  console.log(`[startup] ${resolvedStep.label}...`);
  const result = execute(resolvedStep);

  if (result.error || result.status !== 0) {
    throw new Error(`${resolvedStep.label} failed.`);
  }
};

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  try {
    runStartupBootstrap();

    if (process.argv.includes("--build")) {
      runApplicationStep(NEXT_BUILD_STEP);
    } else if (process.argv.includes("--start")) {
      runApplicationStep(
        NEXT_START_STEP,
        process.argv.slice(2).filter((value) => value !== "--start"),
      );
    } else if (process.argv.includes("--dev")) {
      runApplicationStep(DEVELOPMENT_SERVER_STEP);
    }
  } catch (error) {
    console.error("[startup] PulseTrack preparation failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  }
}
