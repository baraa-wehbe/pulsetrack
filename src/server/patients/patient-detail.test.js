import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAssessmentStatusPresentation,
  getRiskPresentation,
} from "@/lib/assessment-presentation";
import { getActivePatientDetailByMrn } from "@/server/patients/service";

const readSource = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const rawPatient = {
  id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
  mrn: "PT-100",
  firstName: "Leila",
  lastName: "Haddad",
  dateOfBirth: new Date("1990-04-12T00:00:00.000Z"),
  sex: "FEMALE",
  email: "leila@example.test",
  phone: "+961 1 234 567",
  origin: "LOCAL",
  fhirOwnership: "NONE",
  fhirSyncStatus: "NOT_SYNCED",
  fhirLastSyncedAt: null,
  createdAt: new Date("2026-07-01T08:00:00.000Z"),
  updatedAt: new Date("2026-07-20T08:00:00.000Z"),
  assessments: [
    {
      status: "COMPLETED",
      scheduledFor: new Date("2026-07-20T08:00:00.000Z"),
      sentAt: new Date("2026-07-20T08:05:00.000Z"),
      completedAt: new Date("2026-07-20T09:00:00.000Z"),
      createdAt: new Date("2026-07-20T08:00:00.000Z"),
      tokenHash: "must-not-serialize",
      recipientEmail: "must-not-serialize@example.test",
      questionnaire: {
        code: "dsma-8",
        version: "1.0",
        title: "Diabetes Self-Management Assessment (DSMA-8)",
        definition: {
          items: [
            { id: "q1", text: "How often do you follow your meal plan?" },
            { id: "q2", text: "How often do you monitor glucose?" },
          ],
          options: [
            { value: 0, label: "Never" },
            { value: 2, label: "Often" },
          ],
          scoring: { max: 24 },
        },
      },
      response: {
        totalScore: 15,
        riskBand: "HIGH",
        submittedAt: new Date("2026-07-20T09:00:00.000Z"),
        answers: { q1: 2, q2: 0, secret: "must-not-serialize" },
        scoringSnapshot: { secret: "must-not-serialize" },
      },
    },
  ],
};

test("active patient detail uses normalized MRN and safe newest-first selection", async () => {
  let query;
  const prisma = {
    patient: {
      findFirst: async (args) => {
        query = args;
        return rawPatient;
      },
    },
  };

  const patient = await getActivePatientDetailByMrn(prisma, " pt-100 ");

  assert.deepEqual(query.where, { mrn: "PT-100", archivedAt: null });
  assert.deepEqual(query.select.assessments.orderBy, [
    { createdAt: "desc" },
    { id: "desc" },
  ]);
  assert.equal(patient.mrn, "PT-100");
  assert.equal(patient.assessments[0].response.totalScore, 15);
  assert.equal(patient.assessments[0].response.scoreMaximum, 24);
  assert.equal(patient.assessments[0].response.riskBand, "HIGH");
  assert.deepEqual(patient.assessments[0].response.questionResponses, [
    {
      question: "How often do you follow your meal plan?",
      answer: "Often",
    },
    {
      question: "How often do you monitor glucose?",
      answer: "Never",
    },
  ]);
  assert.equal(query.select.assessments.select.response.select.answers, true);
  const serialized = JSON.stringify(patient);
  for (const sensitive of [
    "tokenHash",
    "recipientEmail",
    "answers",
    "scoringSnapshot",
    "lastSendError",
  ]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test("unknown or archived MRNs resolve to no active patient detail", async () => {
  const prisma = {
    patient: {
      findFirst: async () => null,
    },
  };

  assert.equal(await getActivePatientDetailByMrn(prisma, "UNKNOWN"), null);
});

test("assessment status and risk mappings cover stored schema values safely", () => {
  assert.equal(
    getAssessmentStatusPresentation("NOT_SENT").translationKey,
    "assessmentNotSent",
  );
  assert.equal(
    getAssessmentStatusPresentation("COMPLETED").translationKey,
    "assessmentCompleted",
  );
  assert.equal(getRiskPresentation("LOW").guidanceKey, "riskLowGuidance");
  assert.equal(getRiskPresentation("VERY_HIGH").translationKey, "riskVeryHigh");
  assert.equal(
    getRiskPresentation("UNRECOGNIZED").translationKey,
    "assessmentUnknown",
  );
});

test("detail page handles 404s, demographics, history, empty, lab, and safe props", async () => {
  const [page, serialization, loading, sharedLoading, error] =
    await Promise.all([
      readSource("app/(private)/patients/[patientId]/page.js"),
      readSource("server/patients/serialization.js"),
      readSource("app/(private)/patients/[patientId]/loading.js"),
      readSource("components/route-loading.js"),
      readSource("app/(private)/patients/[patientId]/error.js"),
    ]);

  assert.match(page, /patientIdentifierRouteParamsSchema/);
  assert.match(page, /getActivePatientDetailByIdentifier/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /resolvePatientListReturnPath/);
  assert.match(page, /demographics-heading/);
  assert.match(page, /assessment-history-heading/);
  assert.match(page, /getAssessmentTimelineEntries\(assessment\)/);
  assert.match(page, /<details/);
  assert.match(page, /assessmentQuestionResponses/);
  assert.match(page, /assessment\.response\.questionResponses/);
  assert.ok(
    page.indexOf("assessmentQuestionResponses") < page.indexOf("dsmaScore"),
  );
  assert.match(page, /noAssessmentsTitle/);
  assert.match(page, /dsmaScore/);
  assert.match(page, /riskLevel/);
  assert.match(page, /lab-summary-heading/);
  assert.match(page, /patient\.id/);
  assert.doesNotMatch(
    page,
    /tokenHash|recipientEmail|scoringSnapshot|response\.answers/,
  );
  assert.doesNotMatch(serialization, /PATIENT_DETAIL_SELECT[\s\S]*tokenHash/);
  assert.match(loading, /<RouteLoading/);
  assert.match(sharedLoading, /role="status"/);
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /error\.message/);
});
