import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createAssessmentJobHandler } from "@/server/assessments/job-http";
import { isSchedulerAuthorized } from "@/server/assessments/scheduler-auth";

const SECRET = "task-11-test-secret-with-more-than-32-characters";
const request = (authorization) =>
  new Request("http://localhost/api/scheduled/assessments", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });

test("scheduler authorization requires an exact bearer secret", () => {
  assert.equal(isSchedulerAuthorized(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(isSchedulerAuthorized(undefined, SECRET), false);
  assert.equal(isSchedulerAuthorized(`Bearer wrong-${SECRET}`, SECRET), false);
  assert.equal(isSchedulerAuthorized(SECRET, SECRET), false);
  assert.equal(isSchedulerAuthorized(`Bearer ${SECRET}`, "short"), false);
});

test("scheduled endpoint rejects missing and invalid authorization generically", async () => {
  let calls = 0;
  const handler = createAssessmentJobHandler({
    configuredSecret: SECRET,
    prismaClient: {},
    runJob: async () => {
      calls += 1;
    },
  });

  for (const authorization of [undefined, "Bearer invalid-secret"]) {
    const response = await handler(request(authorization));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized." });
    assert.equal(response.headers.get("cache-control"), "no-store, private");
  }
  assert.equal(calls, 0);
});

test("authorized endpoint returns only safe aggregate job results", async () => {
  const now = new Date("2026-07-26T12:00:00.000Z");
  const handler = createAssessmentJobHandler({
    configuredSecret: SECRET,
    prismaClient: { marker: true },
    nowFactory: () => now,
    runJob: async (client, options) => {
      assert.deepEqual(client, { marker: true });
      assert.equal(options.now, now);
      return {
        processed: 3,
        delivered: 1,
        failed: 1,
        skipped: 1,
        cancelled: 1,
        expired: 2,
        rawToken: "must-not-serialize",
      };
    },
  });

  const response = await handler(request(`Bearer ${SECRET}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    processed: 3,
    delivered: 1,
    failed: 1,
    skipped: 1,
    cancelled: 1,
    expired: 2,
  });
});

test("scheduled endpoint reports operational failures without leaking details", async () => {
  const originalError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const handler = createAssessmentJobHandler({
      configuredSecret: SECRET,
      prismaClient: {},
      runJob: async () => {
        throw new Error(`provider credential ${SECRET}`);
      },
    });
    const response = await handler(request(`Bearer ${SECRET}`));

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "Scheduled processing failed.",
    });
    assert.doesNotMatch(JSON.stringify(logged), new RegExp(SECRET));
    assert.match(JSON.stringify(logged), /Error/);
  } finally {
    console.error = originalError;
  }
});

test("local and production cron triggers are registered without exposing secrets", async () => {
  const [route, worker, manualJob, vercel, workflow, packageJson] =
    await Promise.all([
      readFile("src/app/api/scheduled/assessments/route.js", "utf8"),
      readFile("scripts/scheduled-assessment-worker.js", "utf8"),
      readFile("scripts/deliver-due-assessments.js", "utf8"),
      readFile("vercel.json", "utf8"),
      readFile(".github/workflows/scheduled-assessments.yml", "utf8"),
      readFile("package.json", "utf8"),
    ]);

  assert.match(route, /export const GET/);
  assert.match(route, /env\.CRON_SECRET \?\? env\.SCHEDULER_SECRET/);
  assert.match(route, /export const POST/);
  assert.match(worker, /cron\.schedule\("\* \* \* \* \*"/);
  assert.match(worker, /noOverlap: true/);
  assert.match(worker, /path: \["\.env\.local", "\.env"\]/);
  assert.match(worker, /await runDueAssessments\(\)/);
  assert.match(worker, /import\("@\/lib\/prisma-client"\)/);
  assert.match(worker, /import\("@\/server\/assessments\/service"\)/);
  assert.match(manualJob, /path: \["\.env\.local", "\.env"\]/);
  assert.match(manualJob, /import\("@\/lib\/prisma-client"\)/);
  assert.match(manualJob, /import\("@\/server\/assessments\/service"\)/);
  assert.match(vercel, /"path": "\/api\/scheduled\/assessments"/);
  assert.match(vercel, /"schedule": "0 0 \* \* \*"/);
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /secrets\.SCHEDULER_SECRET/);
  assert.match(packageJson, /"dev:scheduler"/);
  for (const source of [
    route,
    worker,
    manualJob,
    vercel,
    workflow,
    packageJson,
  ]) {
    assert.doesNotMatch(source, /Bearer [A-Za-z0-9_-]{32,}|SG\.[A-Za-z0-9_-]+/);
  }
});
