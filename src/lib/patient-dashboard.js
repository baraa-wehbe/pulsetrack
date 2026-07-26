import { z } from "zod";

export const PATIENT_DASHBOARD_METRICS = Object.freeze({
  fastingGlucose: "GLU-F",
  hba1c: "HBA1C",
  systolicBloodPressure: "SBP",
});

export const patientDashboardQuerySchema = z
  .object({
    patient: z.uuid().optional(),
  })
  .strict();

export const parsePatientDashboardQuery = (query = {}) => {
  const patient = typeof query.patient === "string" ? query.patient : undefined;
  const parsed = patientDashboardQuerySchema.safeParse(
    patient ? { patient } : {},
  );

  return parsed.success ? parsed.data : {};
};

const comparePoints = (left, right) =>
  left.date.localeCompare(right.date) || left.order.localeCompare(right.order);

export const orderDashboardPoints = (points) =>
  [...points].sort(comparePoints).map(({ order: _order, ...point }) => point);

export const summarizeMetric = (points, reference = null) => {
  if (points.length === 0) return null;

  const latest = points.at(-1);
  const previous = points.length > 1 ? points.at(-2) : null;
  const change = previous ? latest.value - previous.value : null;
  let referenceState = null;

  if (reference) {
    referenceState =
      reference.low !== null && latest.value < reference.low
        ? "LOW"
        : reference.high !== null && latest.value > reference.high
          ? "HIGH"
          : "IN_RANGE";
  }

  return { latest, previous, change, referenceState };
};
