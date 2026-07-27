import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPatientDetailHref,
  buildPatientListHref,
  getPatientBadge,
  PATIENT_BADGE_MAPPINGS,
  resolvePatientListReturnPath,
} from "@/lib/patient-list";
import {
  PATIENT_LIST_DEFAULTS,
  PATIENT_ORIGIN_VALUES,
  PATIENT_OWNERSHIP_VALUES,
  PATIENT_SYNC_STATUS_VALUES,
} from "@/lib/patient-validation";
import {
  buildActivePatientWhere,
  listActivePatients,
  PATIENT_LIST_ORDER,
} from "@/server/patients/service";

test("search tokens and FHIR filters build one active-only database query", () => {
  const where = buildActivePatientWhere({
    search: " leila pt-10 ",
    origin: "FHIR",
    ownership: "EXTERNAL_READ_ONLY",
    syncStatus: "SYNCED",
  });

  assert.deepEqual(where.AND[0], { archivedAt: null });
  assert.deepEqual(where.AND[1].OR, [
    { mrn: { contains: "LEILA" } },
    { firstName: { contains: "leila", mode: "insensitive" } },
    { lastName: { contains: "leila", mode: "insensitive" } },
  ]);
  assert.deepEqual(where.AND[2].OR[0], { mrn: { contains: "PT-10" } });
  assert.deepEqual(where.AND.slice(-3), [
    { origin: "FHIR" },
    { fhirOwnership: "EXTERNAL_READ_ONLY" },
    { fhirSyncStatus: "SYNCED" },
  ]);
});

test("default query excludes archived patients without adding FHIR filters", () => {
  assert.deepEqual(buildActivePatientWhere(PATIENT_LIST_DEFAULTS), {
    archivedAt: null,
  });
});

test("list pagination uses matching conditions for count and rows", async () => {
  const calls = { count: [], findMany: [], options: null };
  const rawPatient = {
    id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
    mrn: "PT-100",
    firstName: "Leila",
    lastName: "Haddad",
    dateOfBirth: new Date("1990-04-12T00:00:00.000Z"),
    sex: "FEMALE",
    email: "leila@example.test",
    phone: null,
    origin: "FHIR",
    fhirOwnership: "EXTERNAL_READ_ONLY",
    fhirSyncStatus: "SYNCED",
    fhirLastSyncedAt: new Date("2026-07-25T12:00:00.000Z"),
  };
  const transaction = {
    patient: {
      count: async (args) => {
        calls.count.push(args);
        return calls.count.length === 1 ? 23 : 30;
      },
      findMany: async (args) => {
        calls.findMany.push(args);
        return [rawPatient];
      },
    },
  };
  const prisma = {
    $transaction: async (callback, options) => {
      calls.options = options;
      return callback(transaction);
    },
  };
  const query = {
    ...PATIENT_LIST_DEFAULTS,
    search: "pt-",
    page: 2,
  };
  const result = await listActivePatients(prisma, query);

  assert.deepEqual(calls.count[0].where, calls.findMany[0].where);
  assert.equal(calls.findMany[0].skip, 10);
  assert.equal(calls.findMany[0].take, 10);
  assert.deepEqual(calls.findMany[0].orderBy, PATIENT_LIST_ORDER);
  assert.deepEqual(calls.options, { isolationLevel: "RepeatableRead" });
  assert.deepEqual(result.pagination, {
    page: 2,
    pageSize: 10,
    totalCount: 23,
    totalPages: 3,
    hasPreviousPage: true,
    hasNextPage: true,
  });
  assert.equal(result.activePatientCount, 30);
  assert.equal(result.patients[0].fhirSyncStatus, "SYNCED");
  assert.equal("fhirLastSyncError" in result.patients[0], false);
});

test("a page beyond the last page clamps and empty data remains on page one", async () => {
  const createPrisma = (matchingCount) => ({
    $transaction: async (callback) =>
      callback({
        patient: {
          count: async ({ where }) =>
            "archivedAt" in where ? matchingCount : matchingCount,
          findMany: async () => [],
        },
      }),
  });

  const clamped = await listActivePatients(createPrisma(11), {
    ...PATIENT_LIST_DEFAULTS,
    page: 99,
  });
  assert.equal(clamped.pagination.page, 2);

  const empty = await listActivePatients(createPrisma(0), {
    ...PATIENT_LIST_DEFAULTS,
    page: 99,
  });
  assert.equal(empty.pagination.page, 1);
  assert.equal(empty.pagination.totalPages, 1);
});

test("every authoritative enum has a badge mapping and unknown values are safe", () => {
  for (const value of PATIENT_ORIGIN_VALUES) {
    assert.equal(
      getPatientBadge("origin", value),
      PATIENT_BADGE_MAPPINGS.origin[value],
    );
  }
  for (const value of PATIENT_OWNERSHIP_VALUES) {
    assert.equal(
      getPatientBadge("ownership", value),
      PATIENT_BADGE_MAPPINGS.ownership[value],
    );
  }
  for (const value of PATIENT_SYNC_STATUS_VALUES) {
    assert.equal(
      getPatientBadge("syncStatus", value),
      PATIENT_BADGE_MAPPINGS.syncStatus[value],
    );
  }
  assert.equal(
    getPatientBadge("syncStatus", "SURPRISE").translationKey,
    "badgeUnknown",
  );
});

test("pagination links preserve active list state without default noise", () => {
  assert.equal(buildPatientListHref(PATIENT_LIST_DEFAULTS), "/patients");
  assert.equal(
    buildPatientListHref(
      {
        ...PATIENT_LIST_DEFAULTS,
        search: "Leila",
        origin: "FHIR",
        pageSize: 25,
      },
      { page: 2 },
    ),
    "/patients?search=Leila&origin=FHIR&page=2&pageSize=25",
  );
});

test("automatic filter URLs preserve active values and reset pagination", () => {
  const current = {
    ...PATIENT_LIST_DEFAULTS,
    search: "Leila",
    origin: "FHIR",
    ownership: "EXTERNAL_READ_ONLY",
    syncStatus: "SYNCED",
    page: 4,
    pageSize: 25,
  };

  assert.equal(
    buildPatientListHref(current, { search: "Layla", page: 1 }),
    "/patients?search=Layla&origin=FHIR&ownership=EXTERNAL_READ_ONLY&syncStatus=SYNCED&pageSize=25",
  );
  assert.equal(
    buildPatientListHref(current, { origin: "all", page: 1 }),
    "/patients?search=Leila&ownership=EXTERNAL_READ_ONLY&syncStatus=SYNCED&pageSize=25",
  );
  assert.equal(buildPatientListHref(PATIENT_LIST_DEFAULTS), "/patients");
});

test("MRN detail links preserve only validated patient-list state", () => {
  const detailHref = buildPatientDetailHref(
    "8700ba23-32c7-4d26-9497-35fcf7660f51",
    {
      ...PATIENT_LIST_DEFAULTS,
      search: "Leila",
      origin: "FHIR",
      page: 2,
    },
  );

  assert.equal(
    detailHref,
    "/patients/8700ba23-32c7-4d26-9497-35fcf7660f51?returnTo=%2Fpatients%3Fsearch%3DLeila%26origin%3DFHIR%26page%3D2",
  );
  assert.equal(
    resolvePatientListReturnPath("/patients?search=Leila&origin=FHIR&page=2"),
    "/patients?search=Leila&origin=FHIR&page=2",
  );
  for (const unsafe of [
    "https://example.test/patients",
    "//example.test/patients",
    "/dashboard",
    "/patients?archived=true",
    "/patients#private",
  ]) {
    assert.equal(resolvePatientListReturnPath(unsafe), "/patients");
  }
});
