import {
  percentage,
  toClinicDashboardDateBounds,
} from "@/lib/clinic-dashboard";

export const ASSESSMENT_COMPLETION_ELIGIBLE_STATUSES = Object.freeze([
  "SENT",
  "COMPLETED",
  "EXPIRED",
]);

export const ASSESSMENT_DELIVERY_OUTCOME_STATUSES = Object.freeze([
  ...ASSESSMENT_COMPLETION_ELIGIBLE_STATUSES,
  "FAILED",
]);

export const CLINIC_DASHBOARD_ASSESSMENT_STATUSES = Object.freeze([
  "SENT",
  "COMPLETED",
  "FAILED",
  "SCHEDULED",
  "EXPIRED",
]);

export const CLINIC_DASHBOARD_RISK_BANDS = Object.freeze([
  "LOW",
  "MODERATE",
  "HIGH",
  "VERY_HIGH",
]);

const zeroCounts = (values) =>
  Object.fromEntries(values.map((value) => [value, 0]));

const serializeImport = (labImport) => ({
  id: labImport.id,
  originalFileName: labImport.originalFileName,
  status: labImport.status,
  totalRows: labImport.totalRows,
  acceptedRows: labImport.acceptedRows,
  rejectedRows: labImport.rejectedRows,
  duplicateRows: labImport.duplicateRows,
  createdAt: labImport.createdAt.toISOString(),
});

export const getClinicDashboardData = async (
  prismaClient,
  clinicianId,
  range,
) => {
  const bounds = toClinicDashboardDateBounds(range);

  return prismaClient.$transaction(async (transaction) => {
    const [
      activePatientCount,
      groupedAssessments,
      completedResponses,
      recentImports,
      importCounters,
      importsWithFailures,
    ] = await Promise.all([
      transaction.patient.count({ where: { archivedAt: null } }),
      transaction.assessment.groupBy({
        by: ["status"],
        where: {
          createdAt: bounds,
          patient: { archivedAt: null },
          status: { in: CLINIC_DASHBOARD_ASSESSMENT_STATUSES },
        },
        _count: { _all: true },
      }),
      transaction.assessmentResponse.findMany({
        where: {
          submittedAt: bounds,
          assessment: {
            status: "COMPLETED",
            patient: { archivedAt: null },
          },
        },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        select: {
          riskBand: true,
          assessment: { select: { patientId: true } },
        },
      }),
      transaction.labImport.findMany({
        where: { uploadedById: clinicianId, createdAt: bounds },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          id: true,
          originalFileName: true,
          status: true,
          totalRows: true,
          acceptedRows: true,
          rejectedRows: true,
          duplicateRows: true,
          createdAt: true,
        },
      }),
      transaction.labImport.aggregate({
        where: { uploadedById: clinicianId, createdAt: bounds },
        _count: { _all: true },
        _sum: {
          totalRows: true,
          acceptedRows: true,
          rejectedRows: true,
          duplicateRows: true,
        },
      }),
      transaction.labImport.count({
        where: {
          uploadedById: clinicianId,
          createdAt: bounds,
          status: { in: ["FAILED", "COMPLETED_WITH_ERRORS"] },
        },
      }),
    ]);

    const assessmentCounts = zeroCounts(CLINIC_DASHBOARD_ASSESSMENT_STATUSES);
    for (const group of groupedAssessments) {
      assessmentCounts[group.status] = group._count._all;
    }

    const latestPatientRisks = new Map();
    for (const response of completedResponses) {
      const patientId = response.assessment.patientId;
      if (!latestPatientRisks.has(patientId)) {
        latestPatientRisks.set(patientId, response.riskBand);
      }
    }
    const riskDistribution = zeroCounts(CLINIC_DASHBOARD_RISK_BANDS);
    for (const riskBand of latestPatientRisks.values()) {
      if (Object.hasOwn(riskDistribution, riskBand)) {
        riskDistribution[riskBand] += 1;
      }
    }

    // Eligible means successfully sent assessments that can complete:
    // currently SENT, already COMPLETED, or sent but now EXPIRED.
    // SCHEDULED, FAILED delivery, and CANCELLED records are excluded.
    const completionDenominator =
      assessmentCounts.SENT +
      assessmentCounts.COMPLETED +
      assessmentCounts.EXPIRED;
    const deliveryDenominator = completionDenominator + assessmentCounts.FAILED;

    return {
      range,
      lifetime: { activePatientCount },
      assessments: {
        counts: assessmentCounts,
        completionNumerator: assessmentCounts.COMPLETED,
        completionDenominator,
        completionRate: percentage(
          assessmentCounts.COMPLETED,
          completionDenominator,
        ),
        failedDeliveryRate: percentage(
          assessmentCounts.FAILED,
          deliveryDenominator,
        ),
      },
      riskDistribution,
      riskPatientCount: latestPatientRisks.size,
      labQuality: {
        importCount: importCounters._count._all,
        totalRows: importCounters._sum.totalRows ?? 0,
        acceptedRows: importCounters._sum.acceptedRows ?? 0,
        rejectedRows: importCounters._sum.rejectedRows ?? 0,
        duplicateRows: importCounters._sum.duplicateRows ?? 0,
        importsWithFailures,
      },
      recentImports: recentImports.map(serializeImport),
    };
  });
};
