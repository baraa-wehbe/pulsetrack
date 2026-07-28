import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CLINIC_DASHBOARD_MAX_RANGE_DAYS,
  getClinicDashboardDefaultRange,
  parseClinicDashboardQuery,
  percentage,
  toClinicDashboardDateBounds,
} from "@/lib/clinic-dashboard";
import {
  ASSESSMENT_COMPLETION_ELIGIBLE_STATUSES,
  getClinicDashboardData,
} from "@/server/dashboards/clinic";

const readSource = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("date range defaults and valid inclusive bounds are deterministic", () => {
  const now = new Date("2026-07-26T19:45:00.000Z");

  assert.deepEqual(getClinicDashboardDefaultRange(now), {
    start: "2026-06-27",
    end: "2026-07-26",
  });
  assert.deepEqual(parseClinicDashboardQuery({}, now), {
    success: true,
    data: { start: "2026-06-27", end: "2026-07-26" },
  });
  const bounds = toClinicDashboardDateBounds({
    start: "2026-07-01",
    end: "2026-07-26",
  });
  assert.equal(bounds.gte.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(bounds.lt.toISOString(), "2026-07-27T00:00:00.000Z");
});

test("malformed, impossible, reversed, partial, and oversized ranges are rejected", () => {
  assert.equal(
    parseClinicDashboardQuery({ start: "2026-02-30", end: "2026-03-01" }).error,
    "INVALID_DATE",
  );
  assert.equal(
    parseClinicDashboardQuery({ start: "2026-03-02", end: "2026-03-01" }).error,
    "INVALID_ORDER",
  );
  assert.equal(
    parseClinicDashboardQuery({ start: "2026-03-01" }).error,
    "INVALID_DATE",
  );
  assert.equal(
    parseClinicDashboardQuery({ start: "2024-01-01", end: "2026-01-01" }).error,
    "RANGE_TOO_LARGE",
  );
  assert.equal(CLINIC_DASHBOARD_MAX_RANGE_DAYS, 366);
});

const makePrisma = () => {
  const captured = {};
  const transaction = {
    patient: {
      count: async (query) => {
        captured.patient = query;
        return 12;
      },
    },
    assessment: {
      groupBy: async (query) => {
        captured.assessments = query;
        return [
          { status: "SENT", _count: { _all: 3 } },
          { status: "COMPLETED", _count: { _all: 6 } },
          { status: "FAILED", _count: { _all: 1 } },
          { status: "SCHEDULED", _count: { _all: 2 } },
          { status: "EXPIRED", _count: { _all: 1 } },
        ];
      },
    },
    assessmentResponse: {
      findMany: async (query) => {
        captured.responses = query;
        return [
          {
            riskBand: "HIGH",
            assessment: { patientId: "patient-a" },
          },
          {
            riskBand: "LOW",
            assessment: { patientId: "patient-a" },
          },
          {
            riskBand: "MODERATE",
            assessment: { patientId: "patient-b" },
          },
        ];
      },
    },
    labImport: {
      findMany: async (query) => {
        captured.recentImports = query;
        return [
          {
            id: "00000000-0000-4000-8000-000000000002",
            originalFileName: "new.csv",
            status: "COMPLETED_WITH_ERRORS",
            totalRows: 10,
            acceptedRows: 7,
            rejectedRows: 2,
            duplicateRows: 1,
            createdAt: new Date("2026-07-20T09:00:00.000Z"),
          },
          {
            id: "00000000-0000-4000-8000-000000000001",
            originalFileName: "old.csv",
            status: "COMPLETED",
            totalRows: 4,
            acceptedRows: 4,
            rejectedRows: 0,
            duplicateRows: 0,
            createdAt: new Date("2026-07-10T09:00:00.000Z"),
          },
        ];
      },
      aggregate: async (query) => {
        captured.importCounters = query;
        return {
          _count: { _all: 2 },
          _sum: {
            totalRows: 14,
            acceptedRows: 11,
            rejectedRows: 2,
            duplicateRows: 1,
          },
        };
      },
      count: async (query) => {
        captured.failedImports = query;
        return 1;
      },
    },
  };

  return {
    captured,
    prisma: {
      $transaction: async (callback) => callback(transaction),
    },
  };
};

test("aggregates use active patients, consistent range bounds, and clinician-scoped imports", async () => {
  const { captured, prisma } = makePrisma();
  const result = await getClinicDashboardData(prisma, "clinician-1", {
    start: "2026-07-01",
    end: "2026-07-26",
  });

  assert.deepEqual(captured.patient.where, { archivedAt: null });
  assert.deepEqual(captured.assessments.where.patient, { archivedAt: null });
  assert.equal(
    captured.assessments.where.createdAt,
    captured.responses.where.submittedAt,
  );
  for (const query of [
    captured.recentImports,
    captured.importCounters,
    captured.failedImports,
  ]) {
    assert.equal(query.where.uploadedById, "clinician-1");
    assert.deepEqual(
      query.where.createdAt,
      captured.assessments.where.createdAt,
    );
  }
  assert.deepEqual(captured.recentImports.orderBy, [
    { createdAt: "desc" },
    { id: "desc" },
  ]);
  assert.equal(captured.recentImports.take, 5);
  assert.equal(result.lifetime.activePatientCount, 12);
});

test("completion and operational rates use the documented denominators", async () => {
  const { prisma } = makePrisma();
  const result = await getClinicDashboardData(prisma, "clinician-1", {
    start: "2026-07-01",
    end: "2026-07-26",
  });

  assert.deepEqual(ASSESSMENT_COMPLETION_ELIGIBLE_STATUSES, [
    "SENT",
    "COMPLETED",
    "EXPIRED",
  ]);
  assert.equal(result.assessments.completionNumerator, 6);
  assert.equal(result.assessments.completionDenominator, 10);
  assert.equal(result.assessments.completionRate, 60);
  assert.equal(result.assessments.failedDeliveryRate, percentage(1, 11));
  assert.deepEqual(result.labQuality, {
    importCount: 2,
    totalRows: 14,
    acceptedRows: 11,
    rejectedRows: 2,
    duplicateRows: 1,
    importsWithFailures: 1,
  });
});

test("latest completed response counts each patient once with deterministic fallback", async () => {
  const { captured, prisma } = makePrisma();
  const result = await getClinicDashboardData(prisma, "clinician-1", {
    start: "2026-07-01",
    end: "2026-07-26",
  });

  assert.deepEqual(captured.responses.orderBy, [
    { submittedAt: "desc" },
    { id: "desc" },
  ]);
  assert.equal(result.riskPatientCount, 2);
  assert.deepEqual(result.riskDistribution, {
    LOW: 0,
    MODERATE: 1,
    HIGH: 1,
    VERY_HIGH: 0,
  });
});

test("recent uploads are safely serialized and ordered for validation links", async () => {
  const { prisma } = makePrisma();
  const result = await getClinicDashboardData(prisma, "clinician-1", {
    start: "2026-07-01",
    end: "2026-07-26",
  });

  assert.deepEqual(
    result.recentImports.map(({ originalFileName }) => originalFileName),
    ["new.csv", "old.csv"],
  );
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("fileSha256"), false);
  assert.equal(serialized.includes("failureReason"), false);
  assert.equal(serialized.includes("patient-a"), false);
});

test("clinic UI documents scope and denominator and provides safe accessible states", async () => {
  const [pageShell, route, loading, sharedLoading, error, translations] =
    await Promise.all([
      readSource("app/(private)/dashboard/clinic/page.js"),
      readSource("app/(private)/dashboard/clinic/dashboard-route.js"),
      readSource("app/(private)/dashboard/clinic/loading.js"),
      readSource("components/route-loading.js"),
      readSource("app/(private)/dashboard/clinic/error.js"),
      readSource("i18n/translations.js"),
    ]);
  const page = `${pageShell}\n${route}`;

  assert.match(page, /requireCurrentClinician/);
  assert.match(page, /parseClinicDashboardQuery/);
  assert.match(page, /completionRateDefinition/);
  assert.match(page, /clinicianUploadScope/);
  assert.match(page, /href=\{`\/lab-uploads\/\$\{labImport\.id\}`\}/);
  assert.match(page, /noClinicActivityTitle/);
  assert.match(page, /noRecentLabUploads/);
  assert.match(loading, /<RouteLoading/);
  assert.match(sharedLoading, /role="status"/);
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /error\.message/);
  assert.match(translations, /latestRiskDistribution/);

  for (const source of [page, error]) {
    assert.doesNotMatch(
      source,
      /tokenHash|answers|password|fileSha256|failureReason/,
    );
  }
});
