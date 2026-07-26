import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createPatientSchemaForDate,
  createPatientUpdateSchemaForDate,
  getFieldErrors,
  isValidDateOnly,
  parsePatientListPageQuery,
  patientArchiveSchema,
  patientListQuerySchema,
  patientRouteParamsSchema,
} from "@/lib/patient-validation";

const TODAY = "2026-07-25";
const validInput = {
  mrn: "PT-100",
  firstName: "Leila",
  lastName: "Haddad",
  dateOfBirth: "1990-04-12",
  sex: "FEMALE",
  email: "leila@example.test",
  phone: "+961 1 234 567",
};

test("valid patient input passes and optional values remain consistent", () => {
  const schema = createPatientSchemaForDate(TODAY);
  const parsed = schema.parse(validInput);

  assert.deepEqual(parsed, validInput);
  assert.equal(schema.parse({ ...validInput, email: "  " }).email, null);
  assert.equal(schema.parse({ ...validInput, phone: "" }).phone, null);
});

test("MRN and email are trimmed and normalized through the shared schema", () => {
  const parsed = createPatientSchemaForDate(TODAY).parse({
    ...validInput,
    mrn: "  pt-100  ",
    email: "  Leila.Haddad@Example.TEST  ",
  });

  assert.equal(parsed.mrn, "PT-100");
  assert.equal(parsed.email, "leila.haddad@example.test");
});

test("future DOB fails while today's date remains valid", () => {
  const schema = createPatientSchemaForDate(TODAY);
  const future = schema.safeParse({
    ...validInput,
    dateOfBirth: "2026-07-26",
  });
  const today = schema.safeParse({ ...validInput, dateOfBirth: TODAY });

  assert.equal(future.success, false);
  assert.equal(getFieldErrors(future.error).dateOfBirth, "future_date");
  assert.equal(today.success, true);
});

test("invalid calendar dates are rejected deterministically", () => {
  assert.equal(isValidDateOnly("2024-02-29"), true);
  assert.equal(isValidDateOnly("2023-02-29"), false);
  assert.equal(isValidDateOnly("2026-13-01"), false);

  const parsed = createPatientSchemaForDate(TODAY).safeParse({
    ...validInput,
    dateOfBirth: "2026-02-30",
  });

  assert.equal(parsed.success, false);
  assert.equal(getFieldErrors(parsed.error).dateOfBirth, "invalid_date");
});

test("protected and unsupported fields are rejected", () => {
  const protectedFields = [
    "id",
    "archivedAt",
    "createdAt",
    "updatedAt",
    "createdById",
    "origin",
    "fhirResourceId",
  ];

  for (const field of protectedFields) {
    assert.equal(
      createPatientSchemaForDate(TODAY).safeParse({
        ...validInput,
        [field]: "protected",
      }).success,
      false,
    );
  }
});

test("database-aligned maximum lengths and MRN format are enforced", () => {
  const schema = createPatientSchemaForDate(TODAY);

  assert.equal(
    schema.safeParse({ ...validInput, mrn: "A".repeat(51) }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...validInput, mrn: "PT_100" }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...validInput, firstName: "A".repeat(101) }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...validInput, lastName: "A".repeat(101) }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      ...validInput,
      email: `${"a".repeat(310)}@example.test`,
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...validInput, phone: "1".repeat(33) }).success,
    false,
  );
});

test("update, route, list, and archive schemas use strict policies", () => {
  const updateSchema = createPatientUpdateSchemaForDate(TODAY);

  assert.deepEqual(updateSchema.parse({ email: " NEW@Example.Test " }), {
    email: "new@example.test",
  });
  assert.equal(updateSchema.safeParse({}).success, false);
  assert.equal(updateSchema.safeParse({ archivedAt: null }).success, false);
  assert.equal(
    patientRouteParamsSchema.safeParse({
      patientId: "8700ba23-32c7-4d26-9497-35fcf7660f51",
    }).success,
    true,
  );
  assert.equal(
    patientRouteParamsSchema.safeParse({ patientId: "not-a-uuid" }).success,
    false,
  );
  assert.equal(patientListQuerySchema.safeParse({}).success, true);
  assert.deepEqual(patientListQuerySchema.parse({}), {
    search: "",
    origin: "all",
    ownership: "all",
    syncStatus: "all",
    page: 1,
    pageSize: 10,
  });
  assert.deepEqual(
    patientListQuerySchema.parse({
      search: "  pt-100  ",
      origin: "FHIR",
      ownership: "EXTERNAL_READ_ONLY",
      syncStatus: "SYNCED",
      page: "2",
      pageSize: "25",
    }),
    {
      search: "pt-100",
      origin: "FHIR",
      ownership: "EXTERNAL_READ_ONLY",
      syncStatus: "SYNCED",
      page: 2,
      pageSize: 25,
    },
  );
  for (const query of [
    { search: "x".repeat(101) },
    { page: "0" },
    { page: "1.5" },
    { pageSize: "20" },
    { origin: "REMOTE" },
    { ownership: "LOCAL" },
    { syncStatus: "COMPLETE" },
  ]) {
    assert.equal(patientListQuerySchema.safeParse(query).success, false);
  }
  assert.equal(
    patientListQuerySchema.safeParse({ archived: "true" }).success,
    false,
  );
  assert.deepEqual(parsePatientListPageQuery({ page: "bad" }), {
    search: "",
    origin: "all",
    ownership: "all",
    syncStatus: "all",
    page: 1,
    pageSize: 10,
  });
  assert.deepEqual(parsePatientListPageQuery({ ignored: "FHIR" }), {
    search: "",
    origin: "all",
    ownership: "all",
    syncStatus: "all",
    page: 1,
    pageSize: 10,
  });
  assert.equal(patientArchiveSchema.safeParse({}).success, true);
  assert.equal(
    patientArchiveSchema.safeParse({ patientId: "x" }).success,
    false,
  );
});

test("frontend and backend import the same shared patient schema module", async () => {
  const [formSource, collectionRoute, itemRoute] = await Promise.all([
    readFile(new URL("../components/patient-form.js", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/private/patients/route.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/private/patients/[patientId]/route.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const source of [formSource, collectionRoute, itemRoute]) {
    assert.match(source, /@\/lib\/patient-validation/);
  }
});
