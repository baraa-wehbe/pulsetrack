import assert from "node:assert/strict";
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
