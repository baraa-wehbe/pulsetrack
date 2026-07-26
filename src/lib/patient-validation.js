import { z } from "zod";

export const PATIENT_SEX_VALUES = Object.freeze([
  "MALE",
  "FEMALE",
  "OTHER",
  "UNKNOWN",
]);

export const PATIENT_ORIGIN_VALUES = Object.freeze(["LOCAL", "FHIR"]);
export const PATIENT_OWNERSHIP_VALUES = Object.freeze([
  "NONE",
  "CANDIDATE_OWNED",
  "EXTERNAL_READ_ONLY",
]);
export const PATIENT_SYNC_STATUS_VALUES = Object.freeze([
  "NOT_SYNCED",
  "PENDING",
  "SYNCED",
  "FAILED",
]);
export const PATIENT_LIST_ALL = "all";
export const PATIENT_PAGE_SIZE_VALUES = Object.freeze([10, 25, 50]);
export const PATIENT_LIST_DEFAULTS = Object.freeze({
  search: "",
  origin: PATIENT_LIST_ALL,
  ownership: PATIENT_LIST_ALL,
  syncStatus: PATIENT_LIST_ALL,
  page: 1,
  pageSize: 10,
});

export const normalizePatientMrn = (value) => value.trim().toUpperCase();
export const normalizePatientEmail = (value) => value.trim().toLowerCase();

export const getLocalDateOnly = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const isValidDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
};

const requiredText = (maximum) =>
  z
    .string()
    .trim()
    .min(1, "required")
    .max(maximum, "too_long")
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "invalid_text");

const mrnSchema = z
  .string()
  .transform(normalizePatientMrn)
  .pipe(
    z
      .string()
      .min(1, "required")
      .max(50, "too_long")
      .regex(/^[A-Z0-9-]+$/, "invalid_mrn"),
  );

const optionalEmailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) =>
    typeof value === "string" ? normalizePatientEmail(value) || null : null,
  )
  .pipe(
    z.union([z.null(), z.string().max(320, "too_long").email("invalid_email")]),
  );

const optionalPhoneSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) =>
    typeof value === "string" ? value.trim() || null : null,
  )
  .pipe(
    z.union([
      z.null(),
      z
        .string()
        .max(32, "too_long")
        .regex(/^[0-9+().\-\s]+$/, "invalid_phone"),
    ]),
  );

export const createDateOfBirthSchema = (today = getLocalDateOnly()) =>
  z
    .string()
    .trim()
    .refine(isValidDateOnly, "invalid_date")
    .refine(
      (value) => !isValidDateOnly(value) || value <= today,
      "future_date",
    );

export const createPatientSchemaForDate = (today = getLocalDateOnly()) =>
  z
    .object({
      mrn: mrnSchema,
      firstName: requiredText(100),
      lastName: requiredText(100),
      dateOfBirth: createDateOfBirthSchema(today),
      sex: z.enum(PATIENT_SEX_VALUES, { error: "invalid_sex" }),
      email: optionalEmailSchema,
      phone: optionalPhoneSchema,
    })
    .strict();

export const createPatientUpdateSchemaForDate = (today = getLocalDateOnly()) =>
  createPatientSchemaForDate(today)
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: "empty_update",
    });

export const patientCreateSchema = createPatientSchemaForDate();
export const patientUpdateSchema = createPatientUpdateSchemaForDate();

export const patientRouteParamsSchema = z
  .object({
    patientId: z.uuid("invalid_id"),
  })
  .strict();

const optionalFilter = (values) =>
  z.enum([PATIENT_LIST_ALL, ...values]).default(PATIENT_LIST_ALL);

const positiveIntegerQuery = z.string().regex(/^[1-9]\d*$/, "invalid_page");

export const patientListQuerySchema = z
  .object({
    search: z.string().trim().max(100, "too_long").default(""),
    origin: optionalFilter(PATIENT_ORIGIN_VALUES),
    ownership: optionalFilter(PATIENT_OWNERSHIP_VALUES),
    syncStatus: optionalFilter(PATIENT_SYNC_STATUS_VALUES),
    page: positiveIntegerQuery.default("1").transform(Number),
    pageSize: z
      .enum(PATIENT_PAGE_SIZE_VALUES.map(String))
      .default(String(PATIENT_LIST_DEFAULTS.pageSize))
      .transform(Number),
  })
  .strict();

export const parsePatientListPageQuery = (query = {}) => {
  const knownQuery = Object.fromEntries(
    ["search", "origin", "ownership", "syncStatus", "page", "pageSize"]
      .filter((key) => typeof query[key] === "string")
      .map((key) => [key, query[key]]),
  );
  const parsed = patientListQuerySchema.safeParse(knownQuery);

  return parsed.success ? parsed.data : { ...PATIENT_LIST_DEFAULTS };
};
export const patientArchiveSchema = z.object({}).strict();

export const getFieldErrors = (error) => {
  const flattened = z.flattenError(error);

  return Object.fromEntries(
    Object.entries(flattened.fieldErrors).map(([field, messages]) => [
      field,
      messages[0],
    ]),
  );
};
