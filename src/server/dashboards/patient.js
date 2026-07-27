import {
  classifyRange,
  orderDashboardPoints,
  PATIENT_DASHBOARD_METRICS,
  percentage,
  summarizeMetric,
} from "@/lib/patient-dashboard";

const LAB_CODES = Object.freeze(Object.values(PATIENT_DASHBOARD_METRICS));
const ASSESSMENT_STATUSES = [
  "SCHEDULED",
  "SENT",
  "COMPLETED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
];

const asNumber = (value) => (value == null ? null : Number(value));
const dateOnly = (value) => value.toISOString().slice(0, 10);
const zeroCounts = (values) =>
  Object.fromEntries(values.map((value) => [value, 0]));

export const listPatientDashboardOptions = (prismaClient) =>
  prismaClient.patient.findMany({
    where: { archivedAt: null },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
      { mrn: "asc" },
      { id: "asc" },
    ],
    select: { id: true, mrn: true, firstName: true, lastName: true },
  });

const patientSelect = {
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  labResults: {
    where: { testCode: { in: LAB_CODES } },
    orderBy: [{ collectedDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      testCode: true,
      collectedDate: true,
      createdAt: true,
      value: true,
      unit: true,
      refLow: true,
      refHigh: true,
      test: {
        select: {
          name: true,
          defaultUnit: true,
          defaultRefLow: true,
          defaultRefHigh: true,
        },
      },
    },
  },
  assessments: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      scheduledFor: true,
      expiresAt: true,
      completedAt: true,
      createdAt: true,
      sendAttempts: true,
      lastSendError: true,
      response: {
        select: {
          totalScore: true,
          riskBand: true,
          submittedAt: true,
        },
      },
    },
  },
};

const resultReference = (result) => ({
  low: asNumber(result.refLow ?? result.test.defaultRefLow),
  high: asNumber(result.refHigh ?? result.test.defaultRefHigh),
});

const toLabMetric = (patients, code) => {
  const matching = patients.flatMap((patient) =>
    patient.labResults
      .filter((result) => result.testCode === code)
      .map((result) => ({ ...result, patientId: patient.id })),
  );
  const points = orderDashboardPoints(
    matching.map((result) => ({
      date: dateOnly(result.collectedDate),
      value: Number(result.value),
      order: `${result.collectedDate.toISOString()}-${result.id}`,
    })),
  );
  const catalog = matching[0]?.test;
  const reference = matching[0]
    ? resultReference(matching[0])
    : catalog
      ? {
          low: asNumber(catalog.defaultRefLow),
          high: asNumber(catalog.defaultRefHigh),
        }
      : null;

  return {
    code,
    unit: matching[0]?.unit ?? catalog?.defaultUnit ?? null,
    reference,
    points,
    summary: summarizeMetric(points, reference),
  };
};

export const getPatientDashboardData = async (
  prismaClient,
  patientId = null,
  now = new Date(),
) => {
  const where = { archivedAt: null, ...(patientId ? { id: patientId } : {}) };
  const patients = patientId
    ? [
        await prismaClient.patient.findFirst({ where, select: patientSelect }),
      ].filter(Boolean)
    : await prismaClient.patient.findMany({
        where,
        orderBy: [
          { lastName: "asc" },
          { firstName: "asc" },
          { mrn: "asc" },
          { id: "asc" },
        ],
        select: patientSelect,
      });

  if (patientId && patients.length === 0) return null;

  const assessments = patients.flatMap((patient) =>
    patient.assessments.map((assessment) => ({
      ...assessment,
      patientId: patient.id,
    })),
  );
  const assessmentCounts = zeroCounts(ASSESSMENT_STATUSES);
  for (const assessment of assessments) {
    if (Object.hasOwn(assessmentCounts, assessment.status)) {
      assessmentCounts[assessment.status] += 1;
    }
  }
  const responses = assessments.filter((assessment) => assessment.response);
  const questionnairePoints = orderDashboardPoints(
    responses.map((assessment) => ({
      date: assessment.response.submittedAt.toISOString(),
      value: assessment.response.totalScore,
      riskBand: assessment.response.riskBand,
      order: assessment.id,
    })),
  );
  const eligible =
    assessmentCounts.SENT +
    assessmentCounts.COMPLETED +
    assessmentCounts.EXPIRED;

  let inRange = 0;
  let outOfRange = 0;
  const followUp = [];
  const recentActivity = [];

  for (const patient of patients) {
    const reasons = [];
    const overdue = patient.assessments.some(
      (assessment) =>
        (assessment.status === "SCHEDULED" && assessment.scheduledFor < now) ||
        (assessment.status === "SENT" &&
          assessment.expiresAt &&
          assessment.expiresAt < now),
    );
    if (overdue) reasons.push("OVERDUE_ASSESSMENT");
    if (
      patient.assessments.some(
        (assessment) =>
          assessment.status === "FAILED" ||
          (assessment.sendAttempts >= 2 && assessment.lastSendError),
      )
    ) {
      reasons.push("DELIVERY_FAILURE");
    }

    const latestByTest = new Map();
    for (const result of patient.labResults) {
      const state = classifyRange(
        Number(result.value),
        resultReference(result),
      );
      if (state === "IN_RANGE") inRange += 1;
      if (state === "LOW" || state === "HIGH") outOfRange += 1;
      latestByTest.set(result.testCode, result);
      recentActivity.push({
        type: "LAB",
        date: result.collectedDate.toISOString(),
        patientId: patient.id,
        label: result.test.name,
      });
    }
    if (
      [...latestByTest.values()].some((result) =>
        ["LOW", "HIGH"].includes(
          classifyRange(Number(result.value), resultReference(result)),
        ),
      )
    ) {
      reasons.push("ABNORMAL_LAB");
    }
    for (const assessment of patient.assessments) {
      const activityDate =
        assessment.completedAt ??
        assessment.createdAt ??
        assessment.response?.submittedAt;
      if (activityDate) {
        recentActivity.push({
          type: "ASSESSMENT",
          date: activityDate.toISOString(),
          patientId: patient.id,
          label: assessment.status ?? "COMPLETED",
        });
      }
    }
    if (reasons.length) {
      followUp.push({
        patient: {
          id: patient.id,
          mrn: patient.mrn,
          firstName: patient.firstName,
          lastName: patient.lastName,
        },
        reasons,
      });
    }
  }

  recentActivity.sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      left.patientId.localeCompare(right.patientId),
  );

  return {
    scope: patientId ? "PATIENT" : "ALL",
    patient: patientId
      ? {
          id: patients[0].id,
          mrn: patients[0].mrn,
          firstName: patients[0].firstName,
          lastName: patients[0].lastName,
        }
      : null,
    activePatientCount: patients.length,
    assessments: {
      total: assessments.length,
      counts: assessmentCounts,
      completionRate: percentage(assessmentCounts.COMPLETED, eligible),
      responseRate: percentage(responses.length, assessments.length),
      averageScore:
        responses.length === 0
          ? null
          : responses.reduce(
              (sum, assessment) => sum + assessment.response.totalScore,
              0,
            ) / responses.length,
      latestScore: questionnairePoints.at(-1)?.value ?? null,
    },
    labs: { inRange, outOfRange, total: inRange + outOfRange },
    followUp,
    recentActivity: recentActivity.slice(0, 8),
    metrics: {
      fastingGlucose: toLabMetric(
        patients,
        PATIENT_DASHBOARD_METRICS.fastingGlucose,
      ),
      hba1c: toLabMetric(patients, PATIENT_DASHBOARD_METRICS.hba1c),
      systolicBloodPressure: toLabMetric(
        patients,
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
