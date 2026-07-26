import {
  orderDashboardPoints,
  PATIENT_DASHBOARD_METRICS,
  summarizeMetric,
} from "@/lib/patient-dashboard";
import { normalizePatientMrn } from "@/lib/patient-validation";

const LAB_CODES = Object.freeze(Object.values(PATIENT_DASHBOARD_METRICS));

const asNumber = (value) => (value === null ? null : Number(value));
const dateOnly = (value) => value.toISOString().slice(0, 10);

export const listPatientDashboardOptions = async (prismaClient) => {
  const patients = await prismaClient.patient.findMany({
    where: { archivedAt: null },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
      { mrn: "asc" },
      { id: "asc" },
    ],
    select: {
      mrn: true,
      firstName: true,
      lastName: true,
    },
  });

  return patients;
};

const toLabMetric = (results, code) => {
  const matching = results.filter((result) => result.testCode === code);
  const points = orderDashboardPoints(
    matching.map((result) => ({
      date: dateOnly(result.collectedDate),
      value: Number(result.value),
      order: result.id,
    })),
  );
  const catalog = matching[0]?.test;
  const reference = catalog
    ? {
        low: asNumber(catalog.defaultRefLow),
        high: asNumber(catalog.defaultRefHigh),
      }
    : null;

  return {
    code,
    unit: catalog?.defaultUnit ?? null,
    reference,
    points,
    summary: summarizeMetric(points, reference),
  };
};

export const getPatientDashboardData = async (prismaClient, mrn) => {
  const patient = await prismaClient.patient.findFirst({
    where: {
      mrn: normalizePatientMrn(mrn),
      archivedAt: null,
    },
    select: {
      mrn: true,
      firstName: true,
      lastName: true,
      labResults: {
        where: { testCode: { in: LAB_CODES } },
        orderBy: [
          { collectedDate: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          testCode: true,
          collectedDate: true,
          value: true,
          test: {
            select: {
              defaultUnit: true,
              defaultRefLow: true,
              defaultRefHigh: true,
            },
          },
        },
      },
      assessments: {
        where: {
          status: "COMPLETED",
          response: { isNot: null },
        },
        orderBy: [{ completedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          response: {
            select: {
              totalScore: true,
              riskBand: true,
              submittedAt: true,
            },
          },
        },
      },
    },
  });

  if (!patient) return null;

  const questionnairePoints = orderDashboardPoints(
    patient.assessments.map((assessment) => ({
      date: assessment.response.submittedAt.toISOString(),
      value: assessment.response.totalScore,
      riskBand: assessment.response.riskBand,
      order: assessment.id,
    })),
  );

  return {
    patient: {
      mrn: patient.mrn,
      firstName: patient.firstName,
      lastName: patient.lastName,
    },
    metrics: {
      fastingGlucose: toLabMetric(
        patient.labResults,
        PATIENT_DASHBOARD_METRICS.fastingGlucose,
      ),
      hba1c: toLabMetric(patient.labResults, PATIENT_DASHBOARD_METRICS.hba1c),
      systolicBloodPressure: toLabMetric(
        patient.labResults,
        PATIENT_DASHBOARD_METRICS.systolicBloodPressure,
      ),
      questionnaire: {
        unit: null,
        reference: null,
        points: questionnairePoints,
        summary: summarizeMetric(questionnairePoints),
      },
    },
  };
};
