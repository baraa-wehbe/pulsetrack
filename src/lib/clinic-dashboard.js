import { isValidDateOnly } from "@/lib/patient-validation";

export const CLINIC_DASHBOARD_MAX_RANGE_DAYS = 366;
export const CLINIC_DASHBOARD_DEFAULT_RANGE_DAYS = 30;

const dateOnly = (date) => date.toISOString().slice(0, 10);
const fromDateOnly = (value) => new Date(`${value}T00:00:00.000Z`);

export const getClinicDashboardDefaultRange = (now = new Date()) => {
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const start = new Date(end);
  start.setUTCDate(
    start.getUTCDate() - (CLINIC_DASHBOARD_DEFAULT_RANGE_DAYS - 1),
  );

  return { start: dateOnly(start), end: dateOnly(end) };
};

export const parseClinicDashboardQuery = (query = {}, now = new Date()) => {
  const defaults = getClinicDashboardDefaultRange(now);
  const hasStart = typeof query.start === "string";
  const hasEnd = typeof query.end === "string";

  if (!hasStart && !hasEnd) {
    return { success: true, data: defaults };
  }

  if (
    !hasStart ||
    !hasEnd ||
    !isValidDateOnly(query.start) ||
    !isValidDateOnly(query.end)
  ) {
    return { success: false, error: "INVALID_DATE", data: defaults };
  }

  const start = fromDateOnly(query.start);
  const end = fromDateOnly(query.end);
  const rangeDays = Math.floor((end - start) / 86_400_000) + 1;

  if (rangeDays < 1) {
    return { success: false, error: "INVALID_ORDER", data: defaults };
  }

  if (rangeDays > CLINIC_DASHBOARD_MAX_RANGE_DAYS) {
    return { success: false, error: "RANGE_TOO_LARGE", data: defaults };
  }

  return {
    success: true,
    data: { start: query.start, end: query.end },
  };
};

export const toClinicDashboardDateBounds = ({ start, end }) => {
  const exclusiveEnd = fromDateOnly(end);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);

  return {
    gte: fromDateOnly(start),
    lt: exclusiveEnd,
  };
};

export const percentage = (numerator, denominator) =>
  denominator === 0 ? 0 : (numerator / denominator) * 100;
