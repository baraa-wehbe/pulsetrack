import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import {
  SeedPullError,
  upsertExternalObservation,
  upsertExternalPatient,
} from "@/server/fhir/seed-pull";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(6).toString("hex");
const patientIds = [];
const now = new Date("2026-07-26T12:00:00.000Z");

const mappedPatient = (overrides = {}) => ({
  mrn: `PULL-${suffix}`.toUpperCase(),
  firstName: "External",
  lastName: "Seed",
  dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
  sex: "UNKNOWN",
  email: null,
  phone: null,
  origin: "FHIR",
  fhirResourceId: `pull-${suffix}`,
  fhirVersionId: "1",
  fhirOwnership: "EXTERNAL_READ_ONLY",
  fhirSyncStatus: "SYNCED",
  fhirLastSyncError: null,
  ...overrides,
});

test.after(async () => {
  await prisma.labResult.deleteMany({
    where: { patientId: { in: patientIds } },
  });
  await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
  await prisma.$disconnect();
});

test("external patient and Observation upserts are idempotent in PostgreSQL", async () => {
  const mapped = mappedPatient();
  const first = await upsertExternalPatient(prisma, mapped, now);
  patientIds.push(first.id);
  const second = await upsertExternalPatient(
    prisma,
    { ...mapped, fhirVersionId: "2", firstName: "Updated" },
    now,
  );
  assert.equal(second.id, first.id);
  assert.equal(await prisma.patient.count({ where: { mrn: mapped.mrn } }), 1);
  const storedPatient = await prisma.patient.findUniqueOrThrow({
    where: { id: first.id },
  });
  assert.equal(storedPatient.firstName, "Updated");
  assert.equal(storedPatient.fhirVersionId, "2");
  assert.equal(storedPatient.fhirOwnership, "EXTERNAL_READ_ONLY");

  const observation = {
    patientId: first.id,
    testCode: "HBA1C",
    collectedDate: new Date("2026-01-02T00:00:00.000Z"),
    value: 6.4,
    unit: "%",
    refLow: "4",
    refHigh: "5.6",
    source: "FHIR",
    fhirResourceId: `pull-observation-${suffix}`,
    fhirVersionId: "1",
    fhirOwnership: "EXTERNAL_READ_ONLY",
    fhirSyncStatus: "SYNCED",
    fhirLastSyncedAt: now,
    fhirLastSyncError: null,
  };
  await upsertExternalObservation(prisma, observation);
  await upsertExternalObservation(prisma, {
    ...observation,
    value: 6.5,
    fhirVersionId: "2",
  });
  assert.equal(
    await prisma.labResult.count({
      where: { fhirResourceId: observation.fhirResourceId },
    }),
    1,
  );
  const storedResult = await prisma.labResult.findUniqueOrThrow({
    where: { fhirResourceId: observation.fhirResourceId },
  });
  assert.equal(storedResult.value.toString(), "6.5");
  assert.equal(storedResult.fhirVersionId, "2");
});

test("FHIR-ID/MRN split matches and candidate ownership are rejected", async () => {
  const byId = await prisma.patient.create({
    data: {
      ...mappedPatient({
        mrn: `PULL-ID-${suffix}`.toUpperCase(),
        fhirResourceId: `split-${suffix}`,
      }),
      fhirLastSyncedAt: now,
    },
    select: { id: true },
  });
  const byMrn = await prisma.patient.create({
    data: {
      mrn: `PULL-MRN-${suffix}`.toUpperCase(),
      firstName: "Separate",
      lastName: "Patient",
      dateOfBirth: new Date("1991-01-01T00:00:00.000Z"),
      sex: "UNKNOWN",
    },
    select: { id: true },
  });
  patientIds.push(byId.id, byMrn.id);

  await assert.rejects(
    upsertExternalPatient(
      prisma,
      mappedPatient({
        mrn: `PULL-MRN-${suffix}`.toUpperCase(),
        fhirResourceId: `split-${suffix}`,
      }),
      now,
    ),
    (error) =>
      error instanceof SeedPullError &&
      error.code === "PATIENT_IDENTITY_CONFLICT",
  );

  const candidate = await prisma.patient.create({
    data: {
      mrn: `PULL-CANDIDATE-${suffix}`.toUpperCase(),
      firstName: "Candidate",
      lastName: "Owned",
      dateOfBirth: new Date("1992-01-01T00:00:00.000Z"),
      sex: "UNKNOWN",
      fhirResourceId: `candidate-${suffix}`,
      fhirOwnership: "CANDIDATE_OWNED",
      fhirSyncStatus: "SYNCED",
    },
    select: { id: true },
  });
  patientIds.push(candidate.id);
  await assert.rejects(
    upsertExternalPatient(
      prisma,
      mappedPatient({
        mrn: `PULL-CANDIDATE-${suffix}`.toUpperCase(),
        fhirResourceId: `candidate-${suffix}`,
      }),
      now,
    ),
    (error) =>
      error instanceof SeedPullError &&
      error.code === "CANDIDATE_OWNERSHIP_CONFLICT",
  );
});
