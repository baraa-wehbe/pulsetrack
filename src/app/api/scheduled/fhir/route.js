import { env } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { createFhirRetryHandler } from "@/server/fhir/retry-http";

export const dynamic = "force-dynamic";

export const POST = createFhirRetryHandler({
  configuredSecret: env.SCHEDULER_SECRET,
  prismaClient: prisma,
  fhirConfiguration: {
    baseUrl: env.FHIR_BASE_URL,
    apiKey: env.FHIR_API_KEY,
    timeoutMs: env.FHIR_REQUEST_TIMEOUT_MS,
    mrnIdentifierSystem: env.FHIR_MRN_IDENTIFIER_SYSTEM,
    resultIdentifierSystem: env.FHIR_LAB_RESULT_IDENTIFIER_SYSTEM,
  },
});
