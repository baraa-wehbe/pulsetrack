import assert from "node:assert/strict";
import test from "node:test";

import {
  enqueueAcceptedObservationSyncs,
  enqueueObservationSync,
} from "./observation-sync-queue.js";
import { processObservationSyncTask } from "./observation-sync.js";

const identifierSystem = "https://candidate.example/lab-result";
const labResult = {
  id: "10000000-0000-4000-8000-000000000010",
  collectedDate: new Date("2026-07-20T00:00:00.000Z"),
  value: "6.4",
  fhirResourceId: null,
  patient: {
    id: "10000000-0000-4000-8000-000000000001",
    archivedAt: null,
    fhirResourceId: "patient-100",
    fhirOwnership: "CANDIDATE_OWNED",
    fhirSyncStatus: "SYNCED",
  },
  test: {
    code: "HBA1C",
    name: "Hemoglobin A1c",
    loincCode: "4548-4",
    defaultUnit: "%",
    defaultRefLow: "4",
    defaultRefHigh: "5.6",
  },
};

const ownedObservation = (id = "observation-100") => ({
  resourceType: "Observation",
  id,
  identifier: [{ system: identifierSystem, value: labResult.id }],
  meta: { versionId: "3" },
});

const createPrisma = (resultOverrides = {}) => {
  const state = {
    task: {
      id: "20000000-0000-4000-8000-000000000010",
      status: "PENDING",
      attempts: 0,
      lockedAt: null,
      labResult: {
        ...labResult,
        ...resultOverrides,
        patient: {
          ...labResult.patient,
          ...(resultOverrides.patient ?? {}),
        },
      },
    },
    resultUpdates: [],
    patientUpserts: [],
  };
  const taskApi = {
    updateMany: async ({ where, data }) => {
      if (where.status === "PROCESSING" && state.task.status !== "PROCESSING") {
        return { count: 0 };
      }
      if (where.lockedAt && where.lockedAt !== state.task.lockedAt) {
        return { count: 0 };
      }
      state.task = {
        ...state.task,
        ...data,
        attempts: data.attempts?.increment
          ? state.task.attempts + data.attempts.increment
          : state.task.attempts,
      };
      return { count: 1 };
    },
    findUnique: async () => ({
      id: state.task.id,
      attempts: state.task.attempts,
      labResult: state.task.labResult,
    }),
    upsert: async (query) => {
      state.patientUpserts.push(query);
      return { id: "patient-task" };
    },
  };
  const resultApi = {
    update: async ({ data }) => {
      state.resultUpdates.push(data);
      return { id: state.task.labResult.id };
    },
  };
  const prisma = {
    state,
    fhirSyncTask: taskApi,
    $transaction: async (callback) =>
      callback({
        fhirSyncTask: taskApi,
        labResult: resultApi,
      }),
  };
  return prisma;
};

test("Observation enqueue uses one stable task identity", async () => {
  const creates = [];
  const transaction = {
    fhirSyncTask: {
      createMany: async (query) => {
        creates.push(query);
        return { count: creates.length === 1 ? 1 : 0 };
      },
    },
  };
  await enqueueObservationSync(transaction, labResult.id);
  await enqueueObservationSync(transaction, labResult.id);

  assert.equal(creates.length, 2);
  assert.equal(
    creates[0].data[0].deduplicationKey,
    `observation-push:${labResult.id}`,
  );
  assert.equal(
    creates[1].data[0].deduplicationKey,
    creates[0].data[0].deduplicationKey,
  );
  assert.equal(creates[0].skipDuplicates, true);
});

test("post-import enqueue selects accepted rows only and tolerates queue failure", async () => {
  const queries = [];
  let transactionCalls = 0;
  const prisma = {
    labImportRow: {
      findMany: async (query) => {
        queries.push(query);
        return [{ labResultId: labResult.id }];
      },
    },
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("temporary database queue failure");
    },
  };

  await enqueueAcceptedObservationSyncs(prisma, "import-1");
  assert.deepEqual(queries[0].where, {
    importId: "import-1",
    status: "ACCEPTED",
    labResultId: { not: null },
  });
  assert.equal(transactionCalls, 1);
});

test("successful push conditionally creates an Observation linked to exact Patient id", async () => {
  const prisma = createPrisma();
  const calls = [];
  const result = await processObservationSyncTask(
    prisma,
    prisma.state.task.id,
    {
      resultIdentifierSystem: identifierSystem,
      client: {
        getBundle: async () => [],
        post: async (path, resource, options) => {
          calls.push({ path, resource, options });
          return ownedObservation();
        },
      },
    },
  );

  assert.equal(result.succeeded, true);
  assert.equal(calls[0].path, "Observation");
  assert.deepEqual(calls[0].resource.subject, {
    reference: "Patient/patient-100",
  });
  assert.match(calls[0].options.ifNoneExist, /^identifier=/);
  assert.equal(prisma.state.resultUpdates[0].fhirSyncStatus, "SYNCED");
  assert.equal(prisma.state.resultUpdates[0].fhirResourceId, "observation-100");
});

test("missing patient synchronization coalesces patient work and defers safely", async () => {
  const prisma = createPrisma({
    patient: {
      fhirResourceId: null,
      fhirOwnership: "NONE",
      fhirSyncStatus: "NOT_SYNCED",
    },
  });
  let networkCalled = false;
  const result = await processObservationSyncTask(
    prisma,
    prisma.state.task.id,
    {
      resultIdentifierSystem: identifierSystem,
      client: {
        getBundle: async () => {
          networkCalled = true;
        },
      },
    },
  );

  assert.equal(result.deferred, true);
  assert.equal(networkCalled, false);
  assert.equal(prisma.state.patientUpserts.length, 1);
  assert.equal(
    prisma.state.patientUpserts[0].where.deduplicationKey,
    `patient-push:${labResult.patient.id}`,
  );
  assert.equal(prisma.state.task.status, "PENDING");
  assert.equal(prisma.state.task.lastErrorCode, "PATIENT_SYNC_PENDING");
});

test("external patient ownership fails without an Observation request", async () => {
  const prisma = createPrisma({
    patient: {
      fhirOwnership: "EXTERNAL_READ_ONLY",
      fhirSyncStatus: "SYNCED",
    },
  });
  let networkCalled = false;
  const result = await processObservationSyncTask(
    prisma,
    prisma.state.task.id,
    {
      resultIdentifierSystem: identifierSystem,
      client: {
        getBundle: async () => {
          networkCalled = true;
        },
      },
    },
  );
  assert.equal(result.errorCode, "PATIENT_OWNERSHIP_CONFLICT");
  assert.equal(networkCalled, false);
});

test("retry searches first, updates owned exact match, and sanitizes failures", async () => {
  const prisma = createPrisma();
  const failed = await processObservationSyncTask(
    prisma,
    prisma.state.task.id,
    {
      resultIdentifierSystem: identifierSystem,
      client: {
        getBundle: async () => {
          throw new Error("API key, value 6.4, raw provider response");
        },
      },
    },
  );
  assert.equal(failed.errorCode, "PROVIDER_FAILURE");
  assert.doesNotMatch(
    prisma.state.resultUpdates[0].fhirLastSyncError,
    /API key|6\.4|provider response/,
  );

  prisma.state.task.status = "PENDING";
  prisma.state.task.nextAttemptAt = null;
  let postCalled = false;
  let putPath = null;
  const retry = await processObservationSyncTask(prisma, prisma.state.task.id, {
    resultIdentifierSystem: identifierSystem,
    client: {
      getBundle: async () => [{ resource: ownedObservation() }],
      post: async () => {
        postCalled = true;
      },
      put: async (path) => {
        putPath = path;
        return ownedObservation();
      },
    },
  });
  assert.equal(retry.succeeded, true);
  assert.equal(postCalled, false);
  assert.equal(putPath, "Observation/observation-100");
});
