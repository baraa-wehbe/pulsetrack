import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { createFhirClient } from "@/server/fhir/client";
import { processPendingPatientSyncTasks } from "@/server/fhir/patient-sync";

const run = async () => {
  if (
    !env.FHIR_BASE_URL ||
    !env.FHIR_API_KEY ||
    !env.FHIR_MRN_IDENTIFIER_SYSTEM
  ) {
    throw new Error(
      "FHIR patient synchronization requires the server-only FHIR configuration.",
    );
  }

  const client = createFhirClient({
    baseUrl: env.FHIR_BASE_URL,
    apiKey: env.FHIR_API_KEY,
    timeoutMs: env.FHIR_REQUEST_TIMEOUT_MS,
  });
  const result = await processPendingPatientSyncTasks(prisma, {
    client,
    mrnIdentifierSystem: env.FHIR_MRN_IDENTIFIER_SYSTEM,
  });

  process.stdout.write(
    `FHIR patient synchronization complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped.\n`,
  );
};

run()
  .catch(() => {
    process.stderr.write("FHIR patient synchronization failed safely.\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
