import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import {
  exchangeAssessmentToken,
  loadPublicAssessment,
  PublicAssessmentError,
  submitPublicAssessment,
} from "@/server/assessments/public-service";
import {
  createAssessmentToken,
  hashAssessmentToken,
} from "@/server/assessments/token";
import { getActivePatientDetailByMrn } from "@/server/patients/service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(8).toString("hex");
const now = new Date("2026-07-26T12:00:00.000Z");
let clinician;
let patient;
let questionnaire;
const assessmentIds = [];

const validAnswers = () => ({
  answers: Array.from({ length: 8 }, (_, index) => ({
    questionId: `q${index + 1}`,
    value: index < 5 ? 2 : 1,
  })),
});

const createSentAssessment = async ({
  consumed = false,
  expired = false,
} = {}) => {
  const rawToken = createAssessmentToken();
  const assessment = await prisma.assessment.create({
    data: {
      patientId: patient.id,
      questionnaireId: questionnaire.id,
      createdById: clinician.id,
      recipientEmail: patient.email,
      scheduledFor: now,
      status: consumed ? "COMPLETED" : "SENT",
      tokenHash: hashAssessmentToken(rawToken),
      sentAt: expired ? new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) : now,
      expiresAt: new Date(
        now.getTime() + (expired ? -1_000 : 7 * 24 * 60 * 60 * 1000),
      ),
      completedAt: consumed ? now : null,
      tokenConsumedAt: consumed ? now : null,
    },
  });
  assessmentIds.push(assessment.id);
  return { assessment, rawToken };
};

test.before(async () => {
  questionnaire = await prisma.questionnaire.findFirstOrThrow({
    where: { code: "dsma-8", isActive: true },
  });
  clinician = await prisma.clinician.create({
    data: {
      email: `public-assessment-${suffix}@example.test`,
      fullName: "Public Assessment Test Clinician",
      passwordHash: "integration-test-hash-not-a-credential",
      status: "ACTIVE",
    },
  });
  patient = await prisma.patient.create({
    data: {
      mrn: `PUBLIC-${suffix.toUpperCase()}`,
      firstName: "Public",
      lastName: "Assessment",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      sex: "UNKNOWN",
      email: `public-patient-${suffix}@example.test`,
      createdById: clinician.id,
    },
  });
});

test.after(async () => {
  await prisma.auditLog.deleteMany({
    where: { entityType: "ASSESSMENT", entityId: { in: assessmentIds } },
  });
  await prisma.assessment.deleteMany({ where: { id: { in: assessmentIds } } });
  await prisma.patient.deleteMany({ where: { id: patient?.id } });
  await prisma.clinician.deleteMany({ where: { id: clinician?.id } });
  await prisma.$disconnect();
});

test("valid token loads eight stored questions and completes exactly once", async () => {
  const { assessment, rawToken } = await createSentAssessment();
  const exchanged = await exchangeAssessmentToken(prisma, rawToken, now);
  assert.deepEqual(exchanged, { assessmentId: assessment.id });

  const loaded = await loadPublicAssessment(prisma, assessment.id, now);
  assert.equal(loaded.questionnaire.items.length, 8);
  assert.equal(loaded.questionnaire.options.length, 4);

  const result = await submitPublicAssessment(
    prisma,
    assessment.id,
    validAnswers(),
    now,
  );
  assert.deepEqual(result, { completed: true });

  const stored = await prisma.assessment.findUnique({
    where: { id: assessment.id },
    include: { response: true },
  });
  assert.equal(stored.status, "COMPLETED");
  assert.equal(stored.completedAt.toISOString(), now.toISOString());
  assert.equal(stored.tokenConsumedAt.toISOString(), now.toISOString());
  assert.equal(stored.response.totalScore, 13);
  assert.equal(stored.response.riskBand, "HIGH");
  assert.deepEqual(Object.keys(stored.response.answers), [
    "q1",
    "q2",
    "q3",
    "q4",
    "q5",
    "q6",
    "q7",
    "q8",
  ]);

  const detail = await getActivePatientDetailByMrn(prisma, patient.mrn);
  const completed = detail.assessments.find(
    ({ createdAt }) => createdAt === assessment.createdAt.toISOString(),
  );
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.response.totalScore, 13);
  assert.equal(completed.response.riskBand, "HIGH");
});

test("malformed, unknown, expired, and already-used tokens share a safe rejection", async () => {
  const expired = await createSentAssessment({ expired: true });
  const used = await createSentAssessment({ consumed: true });

  for (const token of [
    "malformed",
    createAssessmentToken(),
    expired.rawToken,
    used.rawToken,
  ]) {
    assert.equal(await exchangeAssessmentToken(prisma, token, now), null);
  }
});

test("incomplete and invalid answers create no response and do not consume the token", async () => {
  const { assessment } = await createSentAssessment();
  for (const input of [
    { answers: validAnswers().answers.slice(0, 7) },
    {
      answers: validAnswers().answers.map((answer, index) =>
        index === 0 ? { ...answer, value: 99 } : answer,
      ),
    },
  ]) {
    await assert.rejects(
      submitPublicAssessment(prisma, assessment.id, input, now),
      (error) =>
        error instanceof PublicAssessmentError &&
        error.code === "INVALID_ANSWERS",
    );
  }

  const stored = await prisma.assessment.findUnique({
    where: { id: assessment.id },
    include: { response: true },
  });
  assert.equal(stored.status, "SENT");
  assert.equal(stored.tokenConsumedAt, null);
  assert.equal(stored.response, null);
});

test("concurrent double submission commits one response and rejects the other", async () => {
  const { assessment } = await createSentAssessment();
  const results = await Promise.allSettled([
    submitPublicAssessment(prisma, assessment.id, validAnswers(), now),
    submitPublicAssessment(prisma, assessment.id, validAnswers(), now),
  ]);

  assert.equal(
    results.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(
    await prisma.assessmentResponse.count({
      where: { assessmentId: assessment.id },
    }),
    1,
  );
});

test("raw token is absent from persistence, audit metadata, safe results, and logs", async () => {
  const { assessment, rawToken } = await createSentAssessment();
  const output = [];
  const originalError = console.error;
  console.error = (...values) => output.push(values);
  let result;
  try {
    result = await submitPublicAssessment(
      prisma,
      assessment.id,
      validAnswers(),
      now,
    );
  } finally {
    console.error = originalError;
  }

  const [stored, audits] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessment.id },
      include: { response: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "ASSESSMENT", entityId: assessment.id },
      select: { action: true, metadata: true },
    }),
  ]);
  assert.equal(stored.tokenHash, hashAssessmentToken(rawToken));
  assert.equal(
    JSON.stringify({ stored, audits, result, output }).includes(rawToken),
    false,
  );
});
