import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getPatientBadge } from "@/lib/patient-list";
import {
  checkPatientRemoteStatus,
  FhirManagementError,
  listFhirSyncActivity,
  requestPatientSynchronization,
} from "./management.js";
import { runFullFhirSynchronization } from "./full-sync.js";
import { createFhirRetryHandler } from "./retry-http.js";
import { runFhirRetryJob } from "./retry-job.js";

test("scheduled FHIR endpoint requires scheduler authorization and configuration", async () => {
  let called = false;
  const handler = createFhirRetryHandler({
    configuredSecret: "scheduler-secret-that-is-at-least-32-characters",
    prismaClient: {},
    fhirConfiguration: {},
    runJob: async () => {
      called = true;
    },
  });
  const unauthorized = await handler(
    new Request("https://example.test/api/scheduled/fhir", { method: "POST" }),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(called, false);

  const unconfigured = await handler(
    new Request("https://example.test/api/scheduled/fhir", {
      method: "POST",
      headers: {
        authorization: "Bearer scheduler-secret-that-is-at-least-32-characters",
      },
    }),
  );
  assert.equal(unconfigured.status, 503);
  assert.equal(called, false);
});

test("retry orchestration always processes patients before Observations", async () => {
  const order = [];
  let stored;
  const prisma = {
    fhirSyncRun: {
      create: async () => ({ id: "run" }),
      update: async ({ data }) => {
        stored = data;
        return { id: "run" };
      },
    },
  };
  const result = await runFhirRetryJob(prisma, {
    candidateId: "candidate-test",
    client: {},
    mrnIdentifierSystem: "https://example.test/mrn",
    resultIdentifierSystem: "https://example.test/result",
    now: () => new Date("2026-07-26T12:00:00.000Z"),
    patientProcessor: async (_prisma, options, settings) => {
      assert.equal(options.candidateId, "candidate-test");
      order.push(["PATIENT", settings.maxAttempts]);
      return { discovered: 1, succeeded: 1, failed: 0, skipped: 0 };
    },
    observationProcessor: async (_prisma, options, settings) => {
      assert.equal(options.candidateId, "candidate-test");
      order.push(["OBSERVATION", settings.maxAttempts]);
      return {
        discovered: 2,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        deferred: 1,
      };
    },
  });
  assert.deepEqual(order, [
    ["PATIENT", 5],
    ["OBSERVATION", 5],
  ]);
  assert.equal(result.status, "SUCCEEDED");
  assert.deepEqual(stored.checkpoint.processingOrder, [
    "PATIENT",
    "OBSERVATION",
  ]);
});

test("clinician synchronization retries eligible tasks then pushes and pulls with configured isolation", async () => {
  const order = [];
  let retryQuery;
  const result = await runFullFhirSynchronization(
    {
      fhirSyncTask: {
        updateMany: async (query) => {
          retryQuery = query;
          return { count: 2 };
        },
      },
    },
    { kind: "mock-fhir-client" },
    {
      candidateId: "candidate-test",
      mrnIdentifierSystem: "https://example.test/mrn",
      resultIdentifierSystem: "https://example.test/results",
    },
    {
      push: async (_prisma, options) => {
        order.push("PUSH");
        assert.equal(options.candidateId, "candidate-test");
        assert.equal(options.client.kind, "mock-fhir-client");
        return {
          status: "PARTIAL",
          succeeded: 3,
          failed: 1,
          skipped: 1,
          deferred: 1,
        };
      },
      pull: async (_prisma, client, options) => {
        order.push("PULL");
        assert.equal(client.kind, "mock-fhir-client");
        assert.equal(options.mrnIdentifierSystem, "https://example.test/mrn");
        return { status: "SUCCEEDED", succeeded: 5, failed: 0, skipped: 2 };
      },
    },
  );

  assert.deepEqual(order, ["PUSH", "PULL"]);
  assert.deepEqual(retryQuery.where, {
    status: "FAILED",
    attempts: { lt: 5 },
  });
  assert.deepEqual(result, {
    status: "PARTIAL",
    pushed: { succeeded: 3, failed: 1, skipped: 2 },
    imported: { succeeded: 5, failed: 0, skipped: 2 },
  });
});

test("manual synchronization rejects read-only patients and coalesces eligible work", async () => {
  await assert.rejects(
    requestPatientSynchronization(
      {
        patient: {
          findFirst: async () => ({
            id: "patient",
            fhirOwnership: "EXTERNAL_READ_ONLY",
            labResults: [],
          }),
        },
      },
      "patient",
    ),
    (error) =>
      error instanceof FhirManagementError && error.code === "READ_ONLY",
  );

  const calls = [];
  const transaction = {
    fhirSyncTask: {
      upsert: async (query) => {
        calls.push(query.where.deduplicationKey);
        return { id: "patient-task" };
      },
      createMany: async (query) => {
        calls.push(query.data[0].deduplicationKey);
        return { count: 1 };
      },
      updateMany: async () => ({ count: 2 }),
    },
  };
  const prisma = {
    patient: {
      findFirst: async () => ({
        id: "patient",
        fhirOwnership: "CANDIDATE_OWNED",
        labResults: [{ id: "result" }],
      }),
    },
    $transaction: async (callback) => callback(transaction),
    fhirSyncRun: { create: async () => ({ id: "run" }) },
  };
  const result = await requestPatientSynchronization(prisma, "patient");
  assert.deepEqual(calls, ["patient-push:patient", "observation-push:result"]);
  assert.deepEqual(result, { status: "PENDING", queued: 2 });
});

test("remote status check is read-only and returns safe state only", async () => {
  let writes = 0;
  const result = await checkPatientRemoteStatus(
    {
      patient: {
        findFirst: async () => ({
          mrn: "PRIVATE-MRN",
          fhirResourceId: "remote-patient",
          fhirOwnership: "EXTERNAL_READ_ONLY",
          fhirSyncStatus: "SYNCED",
        }),
        update: async () => {
          writes += 1;
        },
      },
    },
    {
      getBundle: async () => [
        { resource: { resourceType: "Patient", id: "remote-patient" } },
      ],
    },
    "patient",
    "https://example.test/mrn",
  );
  assert.deepEqual(result, {
    remoteStatus: "MATCHED",
    localSyncStatus: "SYNCED",
    ownership: "EXTERNAL_READ_ONLY",
  });
  assert.equal(writes, 0);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-MRN|remote-patient/);
});

test("run history is newest-first and failed-task serialization excludes identifiers", async () => {
  let runQuery;
  const activity = await listFhirSyncActivity(
    {
      fhirSyncRun: {
        findMany: async (query) => {
          runQuery = query;
          return [
            {
              direction: "PUSH",
              trigger: "CRON",
              scope: "ALL",
              status: "PARTIAL",
              discoveredCount: 2,
              succeededCount: 1,
              failedCount: 1,
              skippedCount: 0,
              startedAt: new Date("2026-07-26T10:00:00Z"),
              completedAt: new Date("2026-07-26T10:01:00Z"),
              lastError: "One task requires review.",
            },
          ];
        },
      },
      fhirSyncTask: {
        findMany: async () => [
          {
            resourceType: "OBSERVATION",
            attempts: 2,
            nextAttemptAt: new Date("2026-07-26T11:00:00Z"),
            lastErrorCode: "PROVIDER_FAILURE",
            lastErrorMessage: "FHIR synchronization failed safely.",
            updatedAt: new Date("2026-07-26T10:02:00Z"),
            patientId: "private-patient-id",
            labResultId: "private-result-id",
          },
        ],
      },
    },
    new Date("2026-07-26T12:00:00Z"),
  );
  assert.deepEqual(runQuery.orderBy, [{ startedAt: "desc" }, { id: "desc" }]);
  assert.equal(activity.failures[0].context, "LAB_RESULT");
  assert.equal(activity.failures[0].retryEligible, true);
  assert.doesNotMatch(
    JSON.stringify(activity),
    /private-patient-id|private-result-id/,
  );
});

test("badges cover not configured and private routes retain authentication wrappers", async () => {
  assert.equal(
    getPatientBadge("syncStatus", "NOT_CONFIGURED").translationKey,
    "syncNotConfigured",
  );
  const route = await readFile(
    "src/app/api/private/fhir/patients/[patientId]/route.js",
    "utf8",
  );
  assert.match(route, /withClinicianAuthentication/);
  const fullSyncRoute = await readFile(
    "src/app/api/private/fhir/synchronize/route.js",
    "utf8",
  );
  assert.match(fullSyncRoute, /withClinicianAuthentication/);
  assert.match(fullSyncRoute, /fhirConfiguration\.enabled/);
  assert.doesNotMatch(
    fullSyncRoute,
    /FHIR_API_KEY|authorization|bearer|patientId|mrn/i,
  );
  const [patientWorker, observationWorker] = await Promise.all([
    readFile("src/server/fhir/patient-sync.js", "utf8"),
    readFile("src/server/fhir/observation-sync.js", "utf8"),
  ]);
  for (const worker of [patientWorker, observationWorker]) {
    assert.match(worker, /attempts: \{ lt: maxAttempts \}/);
    assert.match(
      worker,
      /status: "PROCESSING", lockedAt: \{ lt: staleBefore \}/,
    );
    assert.match(worker, /status: "PROCESSING", lockedAt: claimedAt/);
  }
});

test("FHIR status UI is localized and avoids PHI-heavy task context", async () => {
  const [navigation, page, translations] = await Promise.all([
    readFile("src/lib/navigation.js", "utf8"),
    readFile("src/app/(private)/fhir-sync/page.js", "utf8"),
    readFile("src/i18n/translations.js", "utf8"),
  ]);

  assert.match(navigation, /href:\s*"\/fhir-sync"/);
  assert.match(page, /listFhirSyncActivity/);
  assert.match(page, /messages\.syncRuns/);
  assert.match(page, /messages\.failedTasks/);
  assert.match(page, /<FhirSyncControl/);
  assert.match(page, /configured=\{configured\}/);
  assert.doesNotMatch(page, /fhirResourceId|labResultId|patientId|mrn/i);
  assert.match(translations, /fhirSyncHeading:\s*"FHIR synchronization"/);
  assert.match(translations, /fhirSyncHeading:\s*"مزامنة FHIR"/);
  assert.match(translations, /syncNotConfigured:/);
});
