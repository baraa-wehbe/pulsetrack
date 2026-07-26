import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { createFhirClient } from "@/server/fhir/client";
import { pullSeedPatientsAndObservations } from "@/server/fhir/seed-pull";

const run = async () => {
  if (
    !env.FHIR_BASE_URL ||
    !env.FHIR_API_KEY ||
    !env.FHIR_MRN_IDENTIFIER_SYSTEM
  ) {
    throw new Error("FHIR seed pull requires server-only FHIR configuration.");
  }
  const client = createFhirClient({
    baseUrl: env.FHIR_BASE_URL,
    apiKey: env.FHIR_API_KEY,
    timeoutMs: env.FHIR_REQUEST_TIMEOUT_MS,
  });
  const result = await pullSeedPatientsAndObservations(prisma, client, {
    mrnIdentifierSystem: env.FHIR_MRN_IDENTIFIER_SYSTEM,
  });
  process.stdout.write(
    `FHIR seed pull complete: ${result.succeeded} processed, ${result.skipped} skipped, ${result.failed} require review.\n`,
  );
};

run()
  .catch(() => {
    process.stderr.write("FHIR seed pull failed safely.\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
