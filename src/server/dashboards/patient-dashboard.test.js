import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  classifyRange,
  orderDashboardPoints,
  parsePatientDashboardQuery,
  percentage,
  summarizeMetric,
} from "@/lib/patient-dashboard";
import {
  getPatientDashboardData,
  listPatientDashboardOptions,
} from "@/server/dashboards/patient";

const readSource = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const lab = ({
  code,
  date,
  id,
  value,
  unit = "mg/dL",
  low = 70,
  high = 99,
}) => ({
  id,
  testCode: code,
  collectedDate: new Date(`${date}T00:00:00.000Z`),
  value,
  test: {
    defaultUnit: unit,
    defaultRefLow: low,
    defaultRefHigh: high,
  },
});

test("dashboard patient options include only active patients in deterministic order", async () => {
  let query;
  const prisma = {
    patient: {
      findMany: async (args) => {
        query = args;
        return [
          {
            id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
            mrn: "PT-1",
            firstName: "Maya",
            lastName: "Ali",
          },
        ];
      },
    },
  };

  const result = await listPatientDashboardOptions(prisma);

  assert.deepEqual(query.where, { archivedAt: null });
  assert.deepEqual(query.orderBy.at(-1), { id: "asc" });
  assert.deepEqual(Object.keys(query.select).sort(), [
    "firstName",
    "id",
    "lastName",
    "mrn",
  ]);
  assert.equal(result[0].mrn, "PT-1");
});

test("dashboard query scopes to normalized active MRN and selects only supported data", async () => {
  let query;
  const prisma = {
    patient: {
      findFirst: async (args) => {
        query = args;
        return {
          id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
          mrn: "PT-100",
          firstName: "Leila",
          lastName: "Haddad",
          labResults: [],
          assessments: [],
        };
      },
    },
  };

  const result = await getPatientDashboardData(
    prisma,
    "8700ba23-32c7-4d26-9497-35fcf7660f51",
  );

  assert.deepEqual(query.where, {
    id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
    archivedAt: null,
  });
  assert.deepEqual(query.select.labResults.where, {
    testCode: { in: ["GLU-F", "HBA1C", "SBP"] },
  });
  assert.equal(query.select.assessments.where, undefined);
  assert.equal(query.select.assessments.select.status, true);
  assert.equal(result.patient.mrn, "PT-100");
  assert.equal(result.patient.id, "8700ba23-32c7-4d26-9497-35fcf7660f51");
});

test("lab trends are chronological with deterministic same-date ordering and summaries", async () => {
  const prisma = {
    patient: {
      findFirst: async () => ({
        id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
        mrn: "PT-100",
        firstName: "Leila",
        lastName: "Haddad",
        labResults: [
          lab({ code: "GLU-F", date: "2026-07-20", id: "b", value: 130 }),
          lab({ code: "GLU-F", date: "2026-07-10", id: "a", value: 90 }),
          lab({ code: "GLU-F", date: "2026-07-20", id: "a", value: 110 }),
          lab({
            code: "HBA1C",
            date: "2026-07-15",
            id: "c",
            value: 5.2,
            unit: "%",
            low: 4,
            high: 5.6,
          }),
        ],
        assessments: [],
      }),
    },
  };

  const { metrics } = await getPatientDashboardData(
    prisma,
    "8700ba23-32c7-4d26-9497-35fcf7660f51",
  );

  assert.deepEqual(
    metrics.fastingGlucose.points.map((point) => point.value),
    [90, 110, 130],
  );
  assert.equal(metrics.fastingGlucose.summary.latest.value, 130);
  assert.equal(metrics.fastingGlucose.summary.previous.value, 110);
  assert.equal(metrics.fastingGlucose.summary.change, 20);
  assert.equal(metrics.fastingGlucose.summary.referenceState, "HIGH");
  assert.equal(metrics.hba1c.summary.referenceState, "IN_RANGE");
  assert.equal(metrics.systolicBloodPressure.points.length, 0);
});

test("completed questionnaire points retain stored risk and have no invented reference", async () => {
  const prisma = {
    patient: {
      findFirst: async () => ({
        id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
        mrn: "PT-100",
        firstName: "Leila",
        lastName: "Haddad",
        labResults: [],
        assessments: [
          {
            id: "b",
            response: {
              totalScore: 18,
              riskBand: "HIGH",
              submittedAt: new Date("2026-07-20T10:00:00.000Z"),
            },
          },
          {
            id: "a",
            response: {
              totalScore: 8,
              riskBand: "LOW",
              submittedAt: new Date("2026-07-10T10:00:00.000Z"),
            },
          },
        ],
      }),
    },
  };

  const { metrics } = await getPatientDashboardData(
    prisma,
    "8700ba23-32c7-4d26-9497-35fcf7660f51",
  );

  assert.deepEqual(
    metrics.questionnaire.points.map(({ value, riskBand }) => ({
      value,
      riskBand,
    })),
    [
      { value: 8, riskBand: "LOW" },
      { value: 18, riskBand: "HIGH" },
    ],
  );
  assert.equal(metrics.questionnaire.reference, null);
  assert.equal(metrics.questionnaire.summary.referenceState, null);
});

test("query validation, point ordering, and range boundaries are deterministic", () => {
  assert.deepEqual(
    parsePatientDashboardQuery({
      patient: "8700ba23-32c7-4d26-9497-35fcf7660f51",
    }),
    {
      patient: "8700ba23-32c7-4d26-9497-35fcf7660f51",
    },
  );
  assert.deepEqual(parsePatientDashboardQuery({ patient: "../secret" }), {});
  assert.deepEqual(parsePatientDashboardQuery({ unknown: "value" }), {});
  assert.deepEqual(
    orderDashboardPoints([
      { date: "2026-01-01", value: 2, order: "b" },
      { date: "2026-01-01", value: 1, order: "a" },
    ]).map(({ value }) => value),
    [1, 2],
  );
  assert.equal(
    summarizeMetric([{ date: "2026-01-01", value: 70 }], {
      low: 70,
      high: 99,
    }).referenceState,
    "IN_RANGE",
  );
  assert.equal(classifyRange(69, { low: 70, high: 99 }), "LOW");
  assert.equal(classifyRange(99, { low: 70, high: 99 }), "IN_RANGE");
  assert.equal(classifyRange(100, { low: 70, high: 99 }), "HIGH");
  assert.equal(classifyRange(10, null), null);
  assert.equal(percentage(3, 4), 75);
  assert.equal(percentage(0, 0), null);
});

test("aggregate analytics and follow-up rules are deterministic", async () => {
  const now = new Date("2026-07-28T12:00:00.000Z");
  const prisma = {
    patient: {
      findMany: async () => [
        {
          id: "patient-a",
          mrn: "PT-1",
          firstName: "Maya",
          lastName: "Ali",
          assessments: [
            {
              id: "assessment-a",
              status: "SENT",
              expiresAt: new Date("2026-07-27T00:00:00.000Z"),
              scheduledFor: new Date("2026-07-20T00:00:00.000Z"),
              createdAt: new Date("2026-07-20T00:00:00.000Z"),
              completedAt: null,
              sendAttempts: 2,
              lastSendError: "safe test value",
              response: null,
            },
          ],
          labResults: [
            {
              ...lab({
                code: "GLU-F",
                date: "2026-07-27",
                id: "lab-a",
                value: 120,
              }),
              refLow: 70,
              refHigh: 99,
              createdAt: new Date("2026-07-27T00:00:00.000Z"),
              test: {
                name: "Fasting glucose",
                defaultUnit: "mg/dL",
                defaultRefLow: 70,
                defaultRefHigh: 99,
              },
            },
          ],
        },
      ],
    },
  };

  const result = await getPatientDashboardData(prisma, null, now);

  assert.equal(result.scope, "ALL");
  assert.equal(result.activePatientCount, 1);
  assert.equal(result.labs.outOfRange, 1);
  assert.deepEqual(result.followUp[0].reasons, [
    "OVERDUE_ASSESSMENT",
    "DELIVERY_FAILURE",
    "ABNORMAL_LAB",
  ]);
  assert.equal(result.assessments.completionRate, 0);
});

test("empty aggregate and partially populated patients remain honest and safe", async () => {
  const empty = await getPatientDashboardData({
    patient: { findMany: async () => [] },
  });
  assert.equal(empty.activePatientCount, 0);
  assert.equal(empty.assessments.completionRate, null);
  assert.equal(empty.assessments.averageScore, null);
  assert.deepEqual(empty.followUp, []);

  const partial = await getPatientDashboardData({
    patient: {
      findMany: async () => [
        {
          id: "patient-a",
          mrn: "PT-1",
          firstName: "Maya",
          lastName: "Ali",
          assessments: [],
          labResults: [],
        },
      ],
    },
  });
  assert.equal(partial.activePatientCount, 1);
  assert.equal(partial.metrics.questionnaire.summary, null);
  assert.equal(partial.labs.total, 0);
});

test("dashboard UI has aggregate scope, searchable filtering, accessible charts, and no sensitive data", async () => {
  const [page, chart, loading, error, privateLayout] = await Promise.all([
    readSource("app/(private)/dashboard/patient/page.js"),
    readSource("components/time-series-chart.js"),
    readSource("app/(private)/dashboard/patient/loading.js"),
    readSource("app/(private)/dashboard/patient/error.js"),
    readSource("app/(private)/layout.js"),
  ]);

  assert.match(page, /parsePatientDashboardQuery/);
  assert.match(page, /PatientDashboardFilter/);
  assert.match(page, /dashboardScopeAll/);
  assert.match(page, /DonutChart/);
  assert.match(page, /HorizontalBarChart/);
  assert.match(page, /patientsNeedingFollowUp/);
  assert.match(chart, /role="img"/);
  assert.match(chart, /<table className="sr-only">/);
  assert.match(loading, /role="status"/);
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /error\.message/);
  assert.match(privateLayout, /requireCurrentClinician/);

  for (const source of [page, chart]) {
    assert.doesNotMatch(
      source,
      /tokenHash|recipientEmail|answers|scoringSnapshot|session|password/i,
    );
  }
});
