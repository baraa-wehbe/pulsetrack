import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import {
  AssessmentServiceError,
  ASSESSMENT_EXPIRY_MS,
  createAssessment,
  processDueAssessments,
  runAssessmentJob,
} from "@/server/assessments/service";
import { hashAssessmentToken } from "@/server/assessments/token";
import { getActivePatientDetailByMrn } from "@/server/patients/service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(8).toString("hex");
const clinicianEmail = `assessment-${suffix}@example.test`;
const patientMrn = `ASSESS-${suffix.toUpperCase()}`;
const baseTime = new Date("2026-07-26T12:00:00.000Z");

let clinician;
let patient;

test.before(async () => {
  clinician = await prisma.clinician.create({
    data: {
      email: clinicianEmail,
      fullName: "Assessment Test Clinician",
      passwordHash: "integration-test-hash-not-a-credential",
      status: "ACTIVE",
    },
  });
  patient = await prisma.patient.create({
    data: {
      mrn: patientMrn,
      firstName: "Assessment",
      lastName: "Patient",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      sex: "UNKNOWN",
      email: `patient-${suffix}@example.test`,
      createdById: clinician.id,
    },
  });
});

test.after(async () => {
  const assessments = await prisma.assessment.findMany({
    where: { patientId: patient?.id },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      entityType: "ASSESSMENT",
      entityId: { in: assessments.map(({ id }) => id) },
    },
  });
  await prisma.assessment.deleteMany({ where: { patientId: patient?.id } });
  await prisma.patient.deleteMany({ where: { id: patient?.id } });
  await prisma.clinician.deleteMany({ where: { id: clinician?.id } });
  await prisma.$disconnect();
});

test("immediate success emails the raw token but persists and returns only its hash", async () => {
  let providerPayload;
  const result = await createAssessment(
    prisma,
    clinician.id,
    patient.mrn,
    { deliveryMode: "IMMEDIATE", scheduledFor: null },
    {
      now: baseTime,
      clock: () => baseTime,
      appUrl: "https://app.example.test",
      emailSender: async (payload) => {
        providerPayload = payload;
        return { provider: "mock", messageId: "safe-message-1" };
      },
    },
  );

  assert.equal(result.delivered, true);
  assert.equal(result.assessment.status, "SENT");
  assert.match(providerPayload.idempotencyKey, /^[a-f0-9]{64}$/);
  assert.equal(result.assessment.sentAt, baseTime.toISOString());
  assert.equal(
    result.assessment.expiresAt,
    new Date(baseTime.getTime() + ASSESSMENT_EXPIRY_MS).toISOString(),
  );

  const token = new URL(providerPayload.assessmentUrl).pathname
    .split("/")
    .at(-1);
  assert.ok(token);
  const stored = await prisma.assessment.findFirst({
    where: { patientId: patient.id, emailProviderMessageId: "safe-message-1" },
    include: { deliveryAttempts: true },
  });
  assert.equal(stored.tokenHash, hashAssessmentToken(token));
  assert.notEqual(stored.tokenHash, token);
  assert.equal(stored.deliveryAttempts.length, 1);
  assert.equal(stored.deliveryAttempts[0].status, "SUCCEEDED");
  assert.equal(stored.deliveryAttempts[0].attemptedAt instanceof Date, true);

  const audits = await prisma.auditLog.findMany({
    where: { entityType: "ASSESSMENT", entityId: stored.id },
    select: { action: true, metadata: true },
  });
  const persistedAndReturned = JSON.stringify({
    stored: {
      ...stored,
      createdAt: stored.createdAt.toISOString(),
      updatedAt: stored.updatedAt.toISOString(),
    },
    audits,
    result,
  });
  assert.equal(persistedAndReturned.includes(token), false);
  assert.equal(JSON.stringify(result).includes("token"), false);
});

test("failed delivery remains visible and records one sanitized attempt", async () => {
  let emailedUrl;
  const logOutput = [];
  const originalError = console.error;
  console.error = (...values) => logOutput.push(values);
  let result;
  try {
    result = await createAssessment(
      prisma,
      clinician.id,
      patient.mrn,
      { deliveryMode: "IMMEDIATE", scheduledFor: null },
      {
        now: new Date(baseTime.getTime() + 1_000),
        appUrl: "https://app.example.test",
        emailSender: async ({ assessmentUrl }) => {
          emailedUrl = assessmentUrl;
          throw new Error(
            "provider secret=never-persist authorization=never-persist",
          );
        },
      },
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(result.delivered, false);
  assert.equal(result.assessment.status, "FAILED");
  assert.equal(result.assessment.sentAt, null);
  assert.equal(result.assessment.expiresAt, null);
  const token = new URL(emailedUrl).pathname.split("/").at(-1);
  const stored = await prisma.assessment.findFirst({
    where: { patientId: patient.id, status: "FAILED" },
    orderBy: { createdAt: "desc" },
    include: { deliveryAttempts: true },
  });
  assert.equal(stored.deliveryAttempts[0].status, "FAILED");
  assert.equal(
    stored.deliveryAttempts[0].errorMessage,
    "Email delivery could not be confirmed.",
  );
  assert.equal(JSON.stringify(stored).includes("provider secret"), false);
  assert.equal(JSON.stringify(stored).includes(token), false);
  assert.equal(JSON.stringify(logOutput).includes(token), false);
  assert.equal(JSON.stringify(logOutput).includes("provider secret"), false);

  const detail = await getActivePatientDetailByMrn(prisma, patient.mrn);
  const failed = detail.assessments.find(({ status }) => status === "FAILED");
  assert.equal(failed.deliveryFailed, true);
  assert.equal(JSON.stringify(detail).includes("never-persist"), false);
});

test("scheduled assessments remain queued and later use the shared delivery path", async () => {
  const scheduledFor = new Date(baseTime.getTime() + 60 * 60 * 1000);
  let sendCount = 0;
  const created = await createAssessment(
    prisma,
    clinician.id,
    patient.mrn,
    { deliveryMode: "SCHEDULED", scheduledFor },
    { now: baseTime },
  );
  assert.equal(created.scheduled, true);
  assert.equal(created.assessment.status, "SCHEDULED");
  assert.equal(created.assessment.sentAt, null);

  const beforeDue = await processDueAssessments(prisma, {
    now: new Date(baseTime.getTime() + 30 * 60 * 1000),
    emailSender: async () => {
      sendCount += 1;
      return { provider: "mock", messageId: "not-due" };
    },
    appUrl: "https://app.example.test",
  });
  assert.equal(beforeDue.processed, 0);
  assert.equal(sendCount, 0);

  const afterDue = await processDueAssessments(prisma, {
    now: scheduledFor,
    emailSender: async () => {
      sendCount += 1;
      return { provider: "mock", messageId: "scheduled-message" };
    },
    appUrl: "https://app.example.test",
  });
  assert.equal(afterDue.delivered, 1);
  assert.equal(sendCount, 1);
});

test("concurrent and repeated jobs deliver a due assessment at most once and expire sent records", async () => {
  const scheduledFor = new Date(baseTime.getTime() + 4 * 60 * 60 * 1000);
  const created = await createAssessment(
    prisma,
    clinician.id,
    patient.mrn,
    { deliveryMode: "SCHEDULED", scheduledFor },
    { now: baseTime },
  );
  const dueAssessment = await prisma.assessment.findFirstOrThrow({
    where: {
      patientId: patient.id,
      status: "SCHEDULED",
      scheduledFor,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const expiring = await prisma.assessment.create({
    data: {
      patientId: patient.id,
      questionnaireId: (
        await prisma.questionnaire.findFirstOrThrow({
          where: { code: "dsma-8", isActive: true },
          select: { id: true },
        })
      ).id,
      createdById: clinician.id,
      recipientEmail: patient.email,
      scheduledFor: baseTime,
      status: "SENT",
      tokenHash: hashAssessmentToken(`expiry-${suffix}`),
      sentAt: baseTime,
      expiresAt: scheduledFor,
    },
  });
  let sendCount = 0;
  const emailSender = async () => {
    sendCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 75));
    return { provider: "mock", messageId: `concurrent-${suffix}` };
  };
  const options = {
    now: scheduledFor,
    clock: () => scheduledFor,
    appUrl: "https://app.example.test",
    emailSender,
  };

  await Promise.all([
    runAssessmentJob(prisma, options),
    runAssessmentJob(prisma, options),
  ]);
  await runAssessmentJob(prisma, options);

  assert.equal(sendCount, 1);
  assert.equal(
    (
      await prisma.assessment.findUniqueOrThrow({
        where: { id: expiring.id },
        select: { status: true },
      })
    ).status,
    "EXPIRED",
  );
  assert.equal(
    await prisma.assessmentDeliveryAttempt.count({
      where: { assessmentId: dueAssessment.id },
    }),
    1,
  );
  assert.equal(
    (
      await prisma.assessment.findUniqueOrThrow({
        where: { id: dueAssessment.id },
        select: { status: true },
      })
    ).status,
    "SENT",
  );
});

test("archived and unknown patients cannot receive assessments", async () => {
  await assert.rejects(
    createAssessment(
      prisma,
      clinician.id,
      "UNKNOWN-MRN",
      { deliveryMode: "SCHEDULED", scheduledFor: new Date("2026-07-28") },
      { now: baseTime },
    ),
    (error) =>
      error instanceof AssessmentServiceError &&
      error.code === "PATIENT_NOT_FOUND",
  );

  const scheduledFor = new Date(baseTime.getTime() + 3 * 60 * 60 * 1000);
  await createAssessment(
    prisma,
    clinician.id,
    patient.mrn,
    { deliveryMode: "SCHEDULED", scheduledFor },
    { now: baseTime },
  );
  await prisma.patient.update({
    where: { id: patient.id },
    data: { archivedAt: new Date() },
  });
  let sendCount = 0;
  const processing = await processDueAssessments(prisma, {
    now: scheduledFor,
    appUrl: "https://app.example.test",
    emailSender: async () => {
      sendCount += 1;
      return { provider: "mock", messageId: "must-not-send" };
    },
  });
  assert.equal(processing.skipped, 1);
  assert.equal(sendCount, 0);
  assert.equal(
    await prisma.assessment.count({
      where: { patientId: patient.id, status: "CANCELLED" },
    }),
    1,
  );

  await assert.rejects(
    createAssessment(
      prisma,
      clinician.id,
      patient.mrn,
      { deliveryMode: "IMMEDIATE", scheduledFor: null },
      { now: baseTime },
    ),
    (error) =>
      error instanceof AssessmentServiceError &&
      error.code === "PATIENT_NOT_FOUND",
  );
});
