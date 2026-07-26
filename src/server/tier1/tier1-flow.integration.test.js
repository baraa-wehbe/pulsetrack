import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import { getTranslations } from "@/i18n/translations";
import { getClinicDashboardData } from "@/server/dashboards/clinic";
import { getPatientDashboardData } from "@/server/dashboards/patient";
import { createAssessment } from "@/server/assessments/service";
import {
  exchangeAssessmentToken,
  loadPublicAssessment,
  submitPublicAssessment,
} from "@/server/assessments/public-service";
import { authenticateClinicianCredentials } from "@/server/auth/credentials";
import { hashPassword } from "@/server/auth/password";
import { getLabImportDetail } from "@/server/labs/detail";
import { processLabImport } from "@/server/labs/processing";
import { createLabValidationReport } from "@/server/labs/report";
import { createLabImport } from "@/server/labs/service";
import { validateLabCsvFile } from "@/server/labs/validation";
import { createPatient } from "@/server/patients/service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(8).toString("hex");
const password = randomBytes(24).toString("base64url");
const now = new Date("2026-07-26T12:00:00.000Z");
const rawToken = randomBytes(32).toString("base64url");
let clinician;
let patient;
let labImportId;
let emailedUrl;

test.after(async () => {
  if (patient) {
    await prisma.labImport.deleteMany({
      where: { uploadedById: clinician?.id },
    });
    await prisma.labResult.deleteMany({ where: { patientId: patient.id } });
    const assessmentIds = await prisma.assessment.findMany({
      where: { patientId: patient.id },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityType: "PATIENT", entityId: patient.id },
          {
            entityType: "ASSESSMENT",
            entityId: { in: assessmentIds.map(({ id }) => id) },
          },
        ],
      },
    });
    await prisma.assessment.deleteMany({ where: { patientId: patient.id } });
    await prisma.patient.deleteMany({ where: { id: patient.id } });
  }
  if (clinician) {
    await prisma.clinicianSession.deleteMany({
      where: { clinicianId: clinician.id },
    });
    await prisma.clinician.deleteMany({ where: { id: clinician.id } });
  }
  await prisma.$disconnect();
});

test("consolidated Tier 1 clinician-to-dashboard flow", async () => {
  clinician = await prisma.clinician.create({
    data: {
      email: `tier1-${suffix}@example.test`,
      fullName: "Tier One Verification",
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
    },
  });

  const login = await authenticateClinicianCredentials(prisma, {
    email: `  ${clinician.email.toUpperCase()}  `,
    password,
  });
  assert.equal(login.ok, true);
  assert.equal(login.clinicianId, clinician.id);
  assert.equal(JSON.stringify(login).includes(password), false);

  patient = await createPatient(prisma, clinician.id, {
    mrn: `TIER1-${suffix.toUpperCase()}`,
    firstName: "Tier",
    lastName: "Patient",
    dateOfBirth: "1990-01-01",
    sex: "UNKNOWN",
    email: `tier1-patient-${suffix}@example.test`,
    phone: null,
  });

  const delivery = await createAssessment(
    prisma,
    clinician.id,
    patient.id,
    { deliveryMode: "IMMEDIATE", scheduledFor: null },
    {
      now,
      clock: () => now,
      appUrl: "https://example.test",
      tokenFactory: () => rawToken,
      emailSender: async ({ assessmentUrl }) => {
        emailedUrl = assessmentUrl;
        return { provider: "mock", messageId: "tier1-safe-message" };
      },
    },
  );
  assert.equal(delivery.delivered, true);
  assert.equal(emailedUrl.endsWith(`/assessment/${rawToken}`), true);

  const exchanged = await exchangeAssessmentToken(prisma, rawToken, now);
  assert.ok(exchanged?.assessmentId);
  const publicAssessment = await loadPublicAssessment(
    prisma,
    exchanged.assessmentId,
    now,
  );
  assert.equal(publicAssessment.questionnaire.items.length, 8);
  const answerValue = publicAssessment.questionnaire.options[0].value;
  await submitPublicAssessment(
    prisma,
    exchanged.assessmentId,
    {
      answers: publicAssessment.questionnaire.items.map((item) => ({
        questionId: item.id,
        value: answerValue,
      })),
    },
    now,
  );
  assert.equal(await exchangeAssessmentToken(prisma, rawToken, now), null);

  const csv = [
    "mrn,collected_date,test_code,test_name,value,unit,ref_low,ref_high",
    `${patient.mrn},2026-07-20,HBA1C,Ignored,6.1,%,4,5.6`,
    `${patient.mrn},2026-07-20,HBA1C,Duplicate,7.1,%,4,5.6`,
    "UNKNOWN,2026-07-20,GLU-F,Unknown,100,mg/dL,70,99",
  ].join("\n");
  const metadata = await validateLabCsvFile(
    new File([csv], `tier1-${suffix}.csv`, { type: "text/csv" }),
    4096,
  );
  const createdImport = await createLabImport(prisma, clinician.id, metadata);
  labImportId = createdImport.id;
  const processed = await processLabImport(
    prisma,
    createdImport.id,
    metadata.bytes,
    { now },
  );
  assert.deepEqual(
    {
      total: processed.totalRows,
      accepted: processed.acceptedRows,
      rejected: processed.rejectedRows,
      duplicate: processed.duplicateRows,
    },
    { total: 3, accepted: 1, rejected: 1, duplicate: 1 },
  );

  const detail = await getLabImportDetail(
    prisma,
    clinician.id,
    labImportId,
    "all",
  );
  const report = createLabValidationReport(detail, getTranslations("en"));
  assert.equal(detail.rows.length, 3);
  assert.equal(
    report.split("\n").filter((line) => line.startsWith("row,")).length,
    3,
  );

  const patientDashboard = await getPatientDashboardData(prisma, patient.id);
  assert.equal(patientDashboard.metrics.hba1c.points.length, 1);
  assert.equal(patientDashboard.metrics.questionnaire.points.length, 1);
  const clinicDashboard = await getClinicDashboardData(prisma, clinician.id, {
    start: "2026-01-01",
    end: "2026-12-31",
  });
  assert.equal(clinicDashboard.assessments.counts.COMPLETED >= 1, true);
  assert.equal(clinicDashboard.labQuality.acceptedRows >= 1, true);

  const persisted = JSON.stringify(
    {
      assessment: await prisma.assessment.findUnique({
        where: { id: exchanged.assessmentId },
      }),
      attempts: await prisma.assessmentDeliveryAttempt.findMany({
        where: { assessmentId: exchanged.assessmentId },
      }),
      audits: await prisma.auditLog.findMany({
        where: { entityId: exchanged.assessmentId },
      }),
      patientDashboard,
      clinicDashboard,
    },
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
  );
  assert.equal(persisted.includes(rawToken), false);
  assert.equal(persisted.includes(password), false);
});
