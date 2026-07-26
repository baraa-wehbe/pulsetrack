import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env.mjs";
import {
  createPatientSchemaForDate,
  createPatientUpdateSchemaForDate,
} from "@/lib/patient-validation";
import { hashPassword } from "@/server/auth/password";
import {
  archivePatient,
  createPatient,
  getPatientById,
  listActivePatients,
  PATIENT_AUDIT_ACTIONS,
  PatientServiceError,
  updatePatient,
} from "@/server/patients/service";

const TODAY = "2026-07-25";

test("patient CRUD, audit entries, conflicts, and rollbacks enforce database integrity", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  const suffix = randomBytes(8).toString("hex");
  const clinicianEmail = `patient-test-${suffix}@example.test`;
  const patientIds = [];
  let clinicianId;

  try {
    const clinician = await prisma.clinician.create({
      data: {
        email: clinicianEmail,
        passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
        fullName: "Patient Integration Clinician",
      },
      select: { id: true },
    });
    clinicianId = clinician.id;

    const input = createPatientSchemaForDate(TODAY).parse({
      mrn: `  pt-${suffix}  `,
      firstName: "  Leila  ",
      lastName: "  Haddad  ",
      dateOfBirth: "1990-04-12",
      sex: "FEMALE",
      email: "  Leila.Haddad@Example.TEST  ",
      phone: "  +961 1 234 567  ",
    });
    const created = await createPatient(prisma, clinician.id, input);
    patientIds.push(created.id);

    assert.equal(created.mrn, `PT-${suffix.toUpperCase()}`);
    assert.equal(created.email, "leila.haddad@example.test");
    assert.equal(created.dateOfBirth, "1990-04-12");
    assert.equal("createdById" in created, false);
    assert.equal("origin" in created, false);

    const stored = await prisma.patient.findUnique({
      where: { id: created.id },
    });
    assert.equal(stored.mrn, created.mrn);
    assert.equal(stored.email, created.email);
    assert.equal(stored.createdById, clinician.id);

    let auditEntries = await prisma.auditLog.findMany({
      where: { entityType: "PATIENT", entityId: created.id },
      orderBy: { id: "asc" },
    });
    assert.equal(auditEntries.length, 1);
    assert.equal(auditEntries[0].action, PATIENT_AUDIT_ACTIONS.create);
    assert.equal(auditEntries[0].clinicianId, clinician.id);

    const { patients: activePatients } = await listActivePatients(prisma);
    assert.equal(
      activePatients.some(({ id }) => id === created.id),
      true,
    );
    assert.deepEqual(await getPatientById(prisma, created.id), created);
    assert.equal(
      await getPatientById(prisma, "8700ba23-32c7-4d26-9497-35fcf7660f51"),
      null,
    );

    const duplicate = createPatientSchemaForDate(TODAY).parse({
      ...input,
      mrn: ` pt-${suffix} `,
      email: null,
    });
    await assert.rejects(
      createPatient(prisma, clinician.id, duplicate),
      (error) =>
        error instanceof PatientServiceError &&
        error.code === "MRN_CONFLICT" &&
        !error.message.includes("patients_mrn_key"),
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entityType: "PATIENT", entityId: created.id },
      }),
      1,
    );

    const updateInput = createPatientUpdateSchemaForDate(TODAY).parse({
      mrn: ` ${created.mrn.toLowerCase()} `,
      email: "  Updated@Example.TEST ",
      phone: "",
    });
    const updated = await updatePatient(
      prisma,
      clinician.id,
      created.id,
      updateInput,
    );
    assert.equal(updated.changed, true);
    assert.equal(updated.patient.mrn, created.mrn);
    assert.equal(updated.patient.email, "updated@example.test");
    assert.equal(updated.patient.phone, null);

    auditEntries = await prisma.auditLog.findMany({
      where: { entityType: "PATIENT", entityId: created.id },
      orderBy: { id: "asc" },
    });
    assert.equal(auditEntries.length, 2);
    assert.equal(auditEntries[1].action, PATIENT_AUDIT_ACTIONS.update);
    assert.deepEqual(auditEntries[1].metadata.changedFields.sort(), [
      "email",
      "phone",
    ]);

    const noOp = await updatePatient(
      prisma,
      clinician.id,
      created.id,
      updateInput,
    );
    assert.equal(noOp.changed, false);
    assert.equal(
      await prisma.auditLog.count({
        where: { entityType: "PATIENT", entityId: created.id },
      }),
      2,
    );

    const secondInput = createPatientSchemaForDate(TODAY).parse({
      ...input,
      mrn: `PT-SECOND-${suffix}`,
      email: null,
    });
    const second = await createPatient(prisma, clinician.id, secondInput);
    patientIds.push(second.id);

    await assert.rejects(
      updatePatient(
        prisma,
        clinician.id,
        created.id,
        createPatientUpdateSchemaForDate(TODAY).parse({
          mrn: ` pt-second-${suffix} `,
        }),
      ),
      (error) =>
        error instanceof PatientServiceError && error.code === "MRN_CONFLICT",
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entityType: "PATIENT", entityId: created.id },
      }),
      2,
    );

    const rollbackMrn = `PT-ROLLBACK-${suffix}`;
    await assert.rejects(
      createPatient(
        prisma,
        clinician.id,
        createPatientSchemaForDate(TODAY).parse({
          ...input,
          mrn: rollbackMrn,
          email: null,
        }),
        {
          auditWriter: async () => {
            throw new Error("Forced audit failure");
          },
        },
      ),
      /Forced audit failure/,
    );
    assert.equal(
      await prisma.patient.count({ where: { mrn: rollbackMrn.toUpperCase() } }),
      0,
    );

    const nameBeforeRollback = updated.patient.firstName;
    await assert.rejects(
      updatePatient(
        prisma,
        clinician.id,
        created.id,
        createPatientUpdateSchemaForDate(TODAY).parse({
          firstName: "Rollback Name",
        }),
        {
          auditWriter: async () => {
            throw new Error("Forced audit failure");
          },
        },
      ),
      /Forced audit failure/,
    );
    assert.equal(
      (
        await prisma.patient.findUnique({
          where: { id: created.id },
          select: { firstName: true },
        })
      ).firstName,
      nameBeforeRollback,
    );

    await assert.rejects(
      archivePatient(prisma, clinician.id, created.id, {
        auditWriter: async () => {
          throw new Error("Forced audit failure");
        },
      }),
      /Forced audit failure/,
    );
    assert.equal(
      (
        await prisma.patient.findUnique({
          where: { id: created.id },
          select: { archivedAt: true },
        })
      ).archivedAt,
      null,
    );

    const archived = await archivePatient(prisma, clinician.id, created.id, {
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    });
    assert.equal(archived.alreadyArchived, false);
    assert.equal(archived.patient.archivedAt, "2026-07-25T12:00:00.000Z");
    assert.notEqual(await getPatientById(prisma, created.id), null);
    assert.equal(
      (await listActivePatients(prisma)).patients.some(
        ({ id }) => id === created.id,
      ),
      false,
    );

    const repeatedArchive = await archivePatient(
      prisma,
      clinician.id,
      created.id,
    );
    assert.equal(repeatedArchive.alreadyArchived, true);
    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityType: "PATIENT",
          entityId: created.id,
          action: PATIENT_AUDIT_ACTIONS.archive,
        },
      }),
      1,
    );

    await assert.rejects(
      updatePatient(
        prisma,
        clinician.id,
        created.id,
        createPatientUpdateSchemaForDate(TODAY).parse({
          lastName: "Archived Edit",
        }),
      ),
      (error) =>
        error instanceof PatientServiceError && error.code === "ARCHIVED",
    );

    const unknownId = "8700ba23-32c7-4d26-9497-35fcf7660f51";
    await assert.rejects(
      updatePatient(
        prisma,
        clinician.id,
        unknownId,
        createPatientUpdateSchemaForDate(TODAY).parse({
          firstName: "Unknown",
        }),
      ),
      (error) =>
        error instanceof PatientServiceError && error.code === "NOT_FOUND",
    );
    await assert.rejects(
      archivePatient(prisma, clinician.id, unknownId),
      (error) =>
        error instanceof PatientServiceError && error.code === "NOT_FOUND",
    );
  } finally {
    if (patientIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "PATIENT", entityId: { in: patientIds } },
      });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }

    if (clinicianId) {
      await prisma.clinician.delete({ where: { id: clinicianId } });
    }

    await prisma.$disconnect();
  }
});

test("patient list search, FHIR filters, pagination, and ordering execute in PostgreSQL", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  const suffix = randomBytes(8).toString("hex");
  const patientIds = [];
  let clinicianId;

  try {
    const clinician = await prisma.clinician.create({
      data: {
        email: `patient-list-${suffix}@example.test`,
        passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
        fullName: "Patient List Integration Clinician",
      },
      select: { id: true },
    });
    clinicianId = clinician.id;

    for (let index = 0; index < 13; index += 1) {
      const patient = await prisma.patient.create({
        data: {
          mrn: `LIST-${suffix}-${String(index).padStart(2, "0")}`.toUpperCase(),
          firstName: index === 0 ? "Leila" : `Patient${index}`,
          lastName: index === 0 ? `Haddad${suffix}` : "Pagination",
          dateOfBirth: new Date("1990-04-12T00:00:00.000Z"),
          sex: "UNKNOWN",
          origin: index === 0 ? "FHIR" : "LOCAL",
          fhirOwnership: index === 0 ? "EXTERNAL_READ_ONLY" : "CANDIDATE_OWNED",
          fhirSyncStatus: index === 0 ? "FAILED" : "NOT_SYNCED",
          archivedAt:
            index === 12 ? new Date("2026-07-25T12:00:00.000Z") : null,
          createdById: clinician.id,
        },
        select: { id: true },
      });
      patientIds.push(patient.id);
    }

    const firstPage = await listActivePatients(prisma, {
      search: `LIST-${suffix}`,
      origin: "all",
      ownership: "all",
      syncStatus: "all",
      page: 1,
      pageSize: 10,
    });
    assert.equal(firstPage.pagination.totalCount, 12);
    assert.equal(firstPage.pagination.totalPages, 2);
    assert.equal(firstPage.patients.length, 10);
    assert.equal(firstPage.pagination.hasPreviousPage, false);
    assert.equal(firstPage.pagination.hasNextPage, true);
    assert.equal(
      firstPage.patients.some(({ id }) => id === patientIds[12]),
      false,
    );

    const secondPage = await listActivePatients(prisma, {
      ...firstPage.query,
      page: 2,
    });
    assert.equal(secondPage.patients.length, 2);
    assert.equal(secondPage.pagination.hasPreviousPage, true);
    assert.equal(secondPage.pagination.hasNextPage, false);

    const mrnSearch = await listActivePatients(prisma, {
      ...firstPage.query,
      search: `list-${suffix}-00`,
    });
    assert.equal(mrnSearch.pagination.totalCount, 1);
    assert.equal(mrnSearch.patients[0].mrn.endsWith("-00"), true);

    const nameSearch = await listActivePatients(prisma, {
      ...firstPage.query,
      search: `leila haddad${suffix}`,
    });
    assert.equal(nameSearch.pagination.totalCount, 1);
    assert.equal(nameSearch.patients[0].firstName, "Leila");

    const combinedFilters = await listActivePatients(prisma, {
      ...firstPage.query,
      origin: "FHIR",
      ownership: "EXTERNAL_READ_ONLY",
      syncStatus: "FAILED",
    });
    assert.equal(combinedFilters.pagination.totalCount, 1);
    assert.equal(
      combinedFilters.patients[0].fhirOwnership,
      "EXTERNAL_READ_ONLY",
    );
    assert.equal(combinedFilters.patients[0].fhirSyncStatus, "FAILED");

    const beyondFinalPage = await listActivePatients(prisma, {
      ...firstPage.query,
      page: 999,
    });
    assert.equal(beyondFinalPage.pagination.page, 2);
    assert.deepEqual(
      beyondFinalPage.patients.map(({ mrn }) => mrn),
      secondPage.patients.map(({ mrn }) => mrn),
    );
  } finally {
    if (patientIds.length > 0) {
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }
    if (clinicianId) {
      await prisma.clinician.delete({ where: { id: clinicianId } });
    }
    await prisma.$disconnect();
  }
});
