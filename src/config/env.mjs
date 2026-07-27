import { z } from "zod";

import { resolveFhirConfiguration } from "./fhir.mjs";

const optionalEnvironmentValue = (schema) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/, hostname: z.regexes.hostname })
    .min(1),
  AUTH_SECRET: z.string().min(32),
  SCHEDULER_SECRET: z.string().min(32).optional(),
  LAB_CSV_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(5 * 1024 * 1024),
  NEXT_PUBLIC_APP_URL: z.url(),
  SENDGRID_API_KEY: optionalEnvironmentValue(z.string().min(1)),
  ASSESSMENT_EMAIL_FROM: optionalEnvironmentValue(z.string().min(3).max(320)),
  FHIR_BASE_URL: optionalEnvironmentValue(z.url()),
  FHIR_API_KEY: optionalEnvironmentValue(z.string().min(1)),
  FHIR_CANDIDATE_ID: optionalEnvironmentValue(
    z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9._-]+$/),
  ),
  FHIR_MRN_IDENTIFIER_SYSTEM: optionalEnvironmentValue(z.url()),
  FHIR_LAB_RESULT_IDENTIFIER_SYSTEM: optionalEnvironmentValue(z.url()),
  FHIR_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(120_000)
    .default(10_000),
});

const result = environmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SCHEDULER_SECRET: process.env.SCHEDULER_SECRET,
  LAB_CSV_MAX_BYTES: process.env.LAB_CSV_MAX_BYTES,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  ASSESSMENT_EMAIL_FROM: process.env.ASSESSMENT_EMAIL_FROM,
  FHIR_BASE_URL: process.env.FHIR_BASE_URL,
  FHIR_API_KEY: process.env.FHIR_API_KEY,
  FHIR_CANDIDATE_ID: process.env.FHIR_CANDIDATE_ID,
  FHIR_MRN_IDENTIFIER_SYSTEM: process.env.FHIR_MRN_IDENTIFIER_SYSTEM,
  FHIR_LAB_RESULT_IDENTIFIER_SYSTEM:
    process.env.FHIR_LAB_RESULT_IDENTIFIER_SYSTEM,
  FHIR_REQUEST_TIMEOUT_MS: process.env.FHIR_REQUEST_TIMEOUT_MS,
});

if (!result.success) {
  const affectedVariables = [
    ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
  ];

  throw new Error(
    `Invalid environment configuration. Check: ${affectedVariables.join(", ")}`,
  );
}

export const fhirConfiguration = resolveFhirConfiguration({
  baseUrl: result.data.FHIR_BASE_URL,
  apiKey: result.data.FHIR_API_KEY,
  candidateId: result.data.FHIR_CANDIDATE_ID,
  mrnIdentifierSystem: result.data.FHIR_MRN_IDENTIFIER_SYSTEM,
  resultIdentifierSystem: result.data.FHIR_LAB_RESULT_IDENTIFIER_SYSTEM,
  timeoutMs: result.data.FHIR_REQUEST_TIMEOUT_MS,
});

export const env = Object.freeze(result.data);
