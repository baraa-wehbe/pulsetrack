import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env.mjs";

const BASE_URL = "http://localhost:3000";
const email = process.env.PULSETRACK_E2E_EMAIL;
const password = process.env.PULSETRACK_E2E_PASSWORD;
const suffix = randomBytes(6).toString("hex");
const submittedMrn = ` task06-${suffix} `;
const normalizedMrn = submittedMrn.trim().toUpperCase();
const patientIds = [];
let authCookie;

if (!email || !password) {
  throw new Error(
    "PULSETRACK_E2E_EMAIL and PULSETRACK_E2E_PASSWORD are required.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

const request = (path, options = {}) =>
  fetch(`${BASE_URL}${path}`, { redirect: "manual", ...options });

const authenticatedRequest = (path, options = {}) =>
  request(path, {
    ...options,
    headers: {
      ...options.headers,
      Cookie: authCookie,
    },
  });

const jsonBody = (body) => ({
  "Content-Type": "application/json",
  body: JSON.stringify(body),
});

const validInput = {
  mrn: submittedMrn,
  firstName: "HTTP",
  lastName: "Verification",
  dateOfBirth: "1991-08-17",
  sex: "UNKNOWN",
  email: "  Task06.Patient@Example.TEST ",
  phone: " +961 70 000 000 ",
};

const main = async () => {
  try {
    for (const [path, method] of [
      ["/api/private/patients", "GET"],
      ["/api/private/patients", "POST"],
      ["/api/private/patients/8700ba23-32c7-4d26-9497-35fcf7660f51", "GET"],
      [
        "/api/private/patients/8700ba23-32c7-4d26-9497-35fcf7660f51/archive",
        "POST",
      ],
    ]) {
      const response = await request(path, {
        method,
        ...(method === "POST" ? jsonBody({}) : {}),
      });
      assert.equal(response.status, 401);
    }

    const login = await request("/api/auth/login", {
      method: "POST",
      ...jsonBody({ email, password }),
    });
    assert.equal(login.status, 200);
    authCookie = login.headers.get("set-cookie").split(";")[0];
    const clinicianId = (await login.json()).clinician.id;

    const futureMrn = `FUTURE-${suffix}`.toUpperCase();
    const futureCreate = await authenticatedRequest("/api/private/patients", {
      method: "POST",
      ...jsonBody({
        ...validInput,
        mrn: futureMrn,
        dateOfBirth: "9999-12-31",
      }),
    });
    assert.equal(futureCreate.status, 400);
    assert.equal(
      (await futureCreate.json()).fieldErrors.dateOfBirth,
      "future_date",
    );
    assert.equal(await prisma.patient.count({ where: { mrn: futureMrn } }), 0);

    const create = await authenticatedRequest("/api/private/patients", {
      method: "POST",
      ...jsonBody(validInput),
    });
    assert.equal(create.status, 201);
    const createdBody = await create.json();
    const patient = createdBody.patient;
    patientIds.push(patient.id);
    assert.equal(patient.mrn, normalizedMrn);
    assert.equal(patient.email, "task06.patient@example.test");
    assert.equal(patient.dateOfBirth, "1991-08-17");
    for (const protectedField of [
      "createdById",
      "origin",
      "fhirResourceId",
      "auditLogs",
    ]) {
      assert.equal(protectedField in patient, false);
    }

    const stored = await prisma.patient.findUnique({
      where: { id: patient.id },
      select: {
        mrn: true,
        email: true,
        archivedAt: true,
        createdById: true,
      },
    });
    assert.deepEqual(stored, {
      mrn: normalizedMrn,
      email: "task06.patient@example.test",
      archivedAt: null,
      createdById: clinicianId,
    });

    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityType: "PATIENT",
          entityId: patient.id,
          action: "PATIENT_CREATED",
          clinicianId,
        },
      }),
      1,
    );

    const list = await authenticatedRequest("/api/private/patients");
    assert.equal(list.status, 200);
    assert.equal(
      (await list.json()).patients.some(({ id }) => id === patient.id),
      true,
    );
    assert.match(list.headers.get("cache-control"), /no-store/);

    const detail = await authenticatedRequest(
      `/api/private/patients/${patient.id}`,
    );
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).patient.id, patient.id);

    const unknown = await authenticatedRequest(
      "/api/private/patients/8700ba23-32c7-4d26-9497-35fcf7660f51",
    );
    assert.equal(unknown.status, 404);
    const malformed = await authenticatedRequest(
      "/api/private/patients/not-a-uuid",
    );
    assert.equal(malformed.status, 400);

    const duplicate = await authenticatedRequest("/api/private/patients", {
      method: "POST",
      ...jsonBody({
        ...validInput,
        mrn: ` ${normalizedMrn.toLowerCase()} `,
        email: "",
      }),
    });
    assert.equal(duplicate.status, 409);
    const duplicateBody = await duplicate.json();
    assert.deepEqual(duplicateBody.fieldErrors, { mrn: "mrn_conflict" });
    assert.equal(JSON.stringify(duplicateBody).includes("P2002"), false);
    assert.equal(
      JSON.stringify(duplicateBody).includes("patients_mrn_key"),
      false,
    );

    const update = await authenticatedRequest(
      `/api/private/patients/${patient.id}`,
      {
        method: "PATCH",
        ...jsonBody({
          mrn: ` ${normalizedMrn.toLowerCase()} `,
          firstName: "Updated",
          email: " UPDATED.Patient@Example.TEST ",
        }),
      },
    );
    assert.equal(update.status, 200);
    const updatedBody = await update.json();
    assert.equal(updatedBody.changed, true);
    assert.equal(updatedBody.patient.mrn, normalizedMrn);
    assert.equal(updatedBody.patient.firstName, "Updated");
    assert.equal(updatedBody.patient.email, "updated.patient@example.test");

    const auditsAfterUpdate = await prisma.auditLog.findMany({
      where: { entityType: "PATIENT", entityId: patient.id },
      orderBy: { id: "asc" },
    });
    assert.equal(auditsAfterUpdate.length, 2);
    assert.equal(auditsAfterUpdate[1].action, "PATIENT_UPDATED");
    assert.deepEqual(auditsAfterUpdate[1].metadata.changedFields.sort(), [
      "email",
      "firstName",
    ]);

    const noOp = await authenticatedRequest(
      `/api/private/patients/${patient.id}`,
      {
        method: "PATCH",
        ...jsonBody({
          mrn: normalizedMrn,
          firstName: "Updated",
          email: "updated.patient@example.test",
        }),
      },
    );
    assert.equal(noOp.status, 200);
    assert.equal((await noOp.json()).changed, false);
    assert.equal(
      await prisma.auditLog.count({
        where: { entityType: "PATIENT", entityId: patient.id },
      }),
      2,
    );

    const futureUpdate = await authenticatedRequest(
      `/api/private/patients/${patient.id}`,
      {
        method: "PATCH",
        ...jsonBody({ dateOfBirth: "9999-12-31" }),
      },
    );
    assert.equal(futureUpdate.status, 400);
    assert.equal(
      (await futureUpdate.json()).fieldErrors.dateOfBirth,
      "future_date",
    );

    const archive = await authenticatedRequest(
      `/api/private/patients/${patient.id}/archive`,
      { method: "POST", ...jsonBody({}) },
    );
    assert.equal(archive.status, 200);
    assert.equal((await archive.json()).alreadyArchived, false);

    const repeatedArchive = await authenticatedRequest(
      `/api/private/patients/${patient.id}/archive`,
      { method: "POST", ...jsonBody({}) },
    );
    assert.equal(repeatedArchive.status, 200);
    assert.equal((await repeatedArchive.json()).alreadyArchived, true);

    const afterArchiveList = await authenticatedRequest(
      "/api/private/patients",
    );
    assert.equal(
      (await afterArchiveList.json()).patients.some(
        ({ id }) => id === patient.id,
      ),
      false,
    );
    const archivedRow = await prisma.patient.findUnique({
      where: { id: patient.id },
      select: { id: true, mrn: true, archivedAt: true },
    });
    assert.equal(archivedRow.id, patient.id);
    assert.equal(archivedRow.mrn, normalizedMrn);
    assert.notEqual(archivedRow.archivedAt, null);
    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityType: "PATIENT",
          entityId: patient.id,
          action: "PATIENT_ARCHIVED",
          clinicianId,
        },
      }),
      1,
    );

    const archivedDuplicate = await authenticatedRequest(
      "/api/private/patients",
      {
        method: "POST",
        ...jsonBody({ ...validInput, mrn: normalizedMrn }),
      },
    );
    assert.equal(archivedDuplicate.status, 409);

    const archivedUpdate = await authenticatedRequest(
      `/api/private/patients/${patient.id}`,
      {
        method: "PATCH",
        ...jsonBody({ lastName: "Not Allowed" }),
      },
    );
    assert.equal(archivedUpdate.status, 409);
    assert.equal((await archivedUpdate.json()).code, "PATIENT_ARCHIVED");

    const logout = await authenticatedRequest("/api/auth/logout", {
      method: "POST",
    });
    assert.equal(logout.status, 204);
    authCookie = null;

    console.log(
      "Patient API and audit verification passed without exposing credentials or patient payloads.",
    );
  } finally {
    if (authCookie) {
      await authenticatedRequest("/api/auth/logout", {
        method: "POST",
      }).catch(() => {});
    }

    if (patientIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "PATIENT", entityId: { in: patientIds } },
      });
      await prisma.patient.deleteMany({ where: { id: { in: patientIds } } });
    }

    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
