import assert from "node:assert/strict";
import test from "node:test";

import { processPatientSyncTask } from "./patient-sync.js";
import { enqueuePatientSync } from "./patient-sync-queue.js";
import { createPatient, updatePatient } from "../patients/service.js";

const system = "https://candidate.example/mrn";
const patient = {
  id: "10000000-0000-4000-8000-000000000001",
  mrn: "PT-100",
  firstName: "Leila",
  lastName: "Haddad",
  dateOfBirth: new Date("1988-04-12T00:00:00.000Z"),
  sex: "FEMALE",
  email: "leila@example.test",
  phone: null,
  archivedAt: null,
  updatedAt: new Date("2026-07-26T10:00:00.000Z"),
  fhirResourceId: null,
  fhirOwnership: "NONE",
};

const ownedRemote = (id = "remote-100") => ({
  resourceType: "Patient",
  id,
  identifier: [{ system, value: patient.mrn }],
  meta: { versionId: "4" },
});

const createWorkerPrisma = (overrides = {}) => {
  const state = {
    task: {
      id: "20000000-0000-4000-8000-000000000001",
      status: "PENDING",
      attempts: 0,
      lockedAt: null,
      patient: { ...patient, ...overrides.patient },
    },
    patientUpdates: [],
  };

  const taskApi = {
    updateMany: async ({ where, data }) => {
      if (where.status === "PROCESSING" && state.task.status !== "PROCESSING") {
        return { count: 0 };
      }
      if (where.lockedAt && state.task.lockedAt !== where.lockedAt) {
        return { count: 0 };
      }
      if (
        where.OR &&
        !["PENDING", "FAILED", "PROCESSING"].includes(state.task.status)
      ) {
        return { count: 0 };
      }
      state.task = {
        ...state.task,
        ...data,
        attempts:
          data.attempts?.increment === 1
            ? state.task.attempts + 1
            : state.task.attempts,
      };
      return { count: 1 };
    },
    findUnique: async () => ({
      id: state.task.id,
      attempts: state.task.attempts,
      patient: state.task.patient,
    }),
  };
  const patientApi = {
    update: async ({ data }) => {
      state.patientUpdates.push(data);
      state.task.patient = { ...state.task.patient, ...data };
      return { id: state.task.patient.id };
    },
  };
  return {
    state,
    fhirSyncTask: taskApi,
    $transaction: async (callback) =>
      callback({ fhirSyncTask: taskApi, patient: patientApi }),
  };
};

test("enqueue coalesces create/update work with one stable patient identity", async () => {
  const calls = [];
  const transaction = {
    fhirSyncTask: {
      upsert: async (query) => {
        calls.push(query);
        return { id: "task-1" };
      },
    },
    patient: { update: async () => ({ id: patient.id }) },
  };

  await enqueuePatientSync(transaction, patient.id, "CREATE");
  await enqueuePatientSync(transaction, patient.id, "UPDATE");

  assert.equal(calls.length, 2);
  assert.equal(calls[0].where.deduplicationKey, `patient-push:${patient.id}`);
  assert.equal(
    calls[1].where.deduplicationKey,
    calls[0].where.deduplicationKey,
  );
  assert.equal(calls[1].update.status, "PENDING");
  assert.equal(calls[1].update.operation, "UPDATE");
});

test("patient create and changed update enqueue within their local transactions", async () => {
  const enqueued = [];
  const stored = {
    ...patient,
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
  };
  const transaction = {
    patient: {
      create: async () => stored,
      findFirst: async () => stored,
      update: async () => ({ ...stored, firstName: "Layla" }),
    },
  };
  const prisma = { $transaction: async (callback) => callback(transaction) };
  const options = {
    auditWriter: async () => {},
    syncEnqueuer: async (_transaction, id, operation) =>
      enqueued.push({ id, operation }),
  };

  await createPatient(
    prisma,
    "30000000-0000-4000-8000-000000000001",
    {
      mrn: patient.mrn,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: "1988-04-12",
      sex: patient.sex,
      email: patient.email,
      phone: patient.phone,
    },
    options,
  );
  await updatePatient(
    prisma,
    "actor",
    patient.id,
    { firstName: "Layla" },
    options,
  );

  assert.deepEqual(enqueued, [
    { id: patient.id, operation: "CREATE" },
    { id: patient.id, operation: "UPDATE" },
  ]);
});

test("missing remote Patient uses MRN conditional create and persists ownership", async () => {
  const prisma = createWorkerPrisma();
  const calls = [];
  const client = {
    getBundle: async (path) => {
      calls.push(["search", path]);
      return [];
    },
    post: async (path, resource, options) => {
      calls.push(["post", path, resource, options]);
      return ownedRemote();
    },
  };

  const result = await processPatientSyncTask(prisma, prisma.state.task.id, {
    client,
    mrnIdentifierSystem: system,
  });

  assert.equal(result.succeeded, true);
  assert.match(calls[0][1], /Patient\?identifier=/);
  assert.equal(calls[1][1], "Patient");
  assert.match(calls[1][3].ifNoneExist, /^identifier=/);
  assert.equal(prisma.state.patientUpdates[0].fhirOwnership, "CANDIDATE_OWNED");
  assert.equal(prisma.state.patientUpdates[0].fhirSyncStatus, "SYNCED");
  assert.equal(prisma.state.patientUpdates[0].fhirResourceId, "remote-100");
});

test("confirmed candidate-owned match updates only its exact FHIR id", async () => {
  const prisma = createWorkerPrisma({
    patient: {
      fhirResourceId: "remote-100",
      fhirOwnership: "CANDIDATE_OWNED",
    },
  });
  const calls = [];
  const client = {
    getBundle: async () => [{ resource: ownedRemote() }],
    put: async (path, resource) => {
      calls.push({ path, resource });
      return ownedRemote();
    },
  };

  const result = await processPatientSyncTask(prisma, prisma.state.task.id, {
    client,
    mrnIdentifierSystem: system,
  });

  assert.equal(result.succeeded, true);
  assert.equal(calls[0].path, "Patient/remote-100");
  assert.equal(calls[0].resource.id, "remote-100");
});

test("external ownership and multiple matches fail safely without writes", async () => {
  for (const scenario of [
    {
      expected: "EXTERNAL_OWNERSHIP",
      entries: [
        {
          resource: {
            resourceType: "Patient",
            id: "external-1",
            identifier: [
              { system: "https://external.example/mrn", value: "PT-100" },
            ],
          },
        },
      ],
    },
    {
      expected: "MULTIPLE_MATCHES",
      entries: [
        { resource: ownedRemote("one") },
        { resource: ownedRemote("two") },
      ],
    },
  ]) {
    const prisma = createWorkerPrisma();
    let writeCalled = false;
    const result = await processPatientSyncTask(prisma, prisma.state.task.id, {
      client: {
        getBundle: async () => scenario.entries,
        post: async () => {
          writeCalled = true;
        },
        put: async () => {
          writeCalled = true;
        },
      },
      mrnIdentifierSystem: system,
    });

    assert.equal(result.errorCode, scenario.expected);
    assert.equal(writeCalled, false);
    assert.equal(prisma.state.patientUpdates[0].fhirSyncStatus, "FAILED");
    assert.doesNotMatch(
      prisma.state.patientUpdates[0].fhirLastSyncError,
      /PT-100|Leila|external\.example/,
    );
  }
});

test("ambiguous provider failure is sanitized and retry re-search is idempotent", async () => {
  const prisma = createWorkerPrisma();
  const first = await processPatientSyncTask(prisma, prisma.state.task.id, {
    client: {
      getBundle: async () => [],
      post: async () => {
        throw new Error("api-key patient PT-100 provider payload");
      },
    },
    mrnIdentifierSystem: system,
  });
  assert.equal(first.errorCode, "PROVIDER_FAILURE");
  assert.doesNotMatch(
    prisma.state.patientUpdates[0].fhirLastSyncError,
    /api-key|PT-100|payload/,
  );

  prisma.state.task.status = "PENDING";
  prisma.state.task.nextAttemptAt = null;
  let postCalled = false;
  const retry = await processPatientSyncTask(prisma, prisma.state.task.id, {
    client: {
      getBundle: async () => [{ resource: ownedRemote() }],
      put: async () => ownedRemote(),
      post: async () => {
        postCalled = true;
      },
    },
    mrnIdentifierSystem: system,
  });
  assert.equal(retry.succeeded, true);
  assert.equal(postCalled, false);
});
