import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEVELOPMENT_SERVER_STEP,
  NEXT_BUILD_STEP,
  NEXT_START_STEP,
  runApplicationStep,
  runStartupBootstrap,
  STARTUP_STEPS,
} from "./bootstrap-server.mjs";
import { readStartupClinician } from "./provision-startup-clinician.js";

test("startup bootstrap runs every safe Prisma preparation step in order", () => {
  const calls = [];

  runStartupBootstrap(STARTUP_STEPS, (step) => {
    calls.push([step.executable, ...step.arguments]);
    return { status: 0 };
  });

  assert.deepEqual(calls, [
    [process.execPath, "node_modules/prisma/build/index.js", "validate"],
    [process.execPath, "node_modules/prisma/build/index.js", "generate"],
    [
      process.execPath,
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
    ],
    [process.execPath, "node_modules/prisma/build/index.js", "db", "seed"],
    [
      process.execPath,
      "node_modules/tsx/dist/cli.mjs",
      "--tsconfig",
      "jsconfig.json",
      "scripts/provision-startup-clinician.js",
    ],
  ]);
});

test("startup bootstrap stops before server launch when a required step fails", () => {
  const calls = [];

  assert.throws(
    () =>
      runStartupBootstrap(STARTUP_STEPS, (step) => {
        calls.push(step.label);
        return { status: calls.length === 3 ? 1 : 0 };
      }),
    /Deploy pending database migrations failed/,
  );
  assert.equal(calls.length, 3);
});

test("startup clinician fixture contains the requested account", async () => {
  assert.deepEqual(await readStartupClinician(), {
    email: "clinician@pulsetrack.com",
    fullName: "PulseTrack Clinician",
    password: "PulseTrack@1234",
  });
});

test("primary server commands use the shared bootstrap launcher", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(
    packageJson.scripts.dev,
    "node scripts/bootstrap-server.mjs --dev",
  );
  assert.equal(
    packageJson.scripts.start,
    "node scripts/bootstrap-server.mjs --start",
  );
  assert.equal(
    packageJson.scripts["clinician:bootstrap"],
    "tsx --tsconfig jsconfig.json scripts/provision-startup-clinician.js",
  );
  assert.equal(
    packageJson.scripts["vercel-build"],
    "node scripts/bootstrap-server.mjs --build",
  );
  assert.deepEqual(NEXT_BUILD_STEP.arguments, [
    "node_modules/next/dist/bin/next",
    "build",
  ]);
  assert.deepEqual(NEXT_START_STEP.arguments, [
    "node_modules/next/dist/bin/next",
    "start",
  ]);
  assert.match(DEVELOPMENT_SERVER_STEP.arguments[0], /concurrently/);
});

test("server arguments are forwarded only after bootstrap completes", () => {
  let executed;
  runApplicationStep(NEXT_START_STEP, ["--port", "3002"], (step) => {
    executed = step;
    return { status: 0 };
  });

  assert.deepEqual(executed.arguments, [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    "3002",
  ]);
});
