import { env } from "../src/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { createFhirClient } from "@/server/fhir/client";
import { processPendingObservationSyncTasks } from "@/server/fhir/observation-sync";
import { processPendingPatientSyncTasks } from "@/server/fhir/patient-sync";

const run = async () => {
  if (
    !env.FHIR_BASE_URL ||
    !env.FHIR_API_KEY ||
    !env.FHIR_CANDIDATE_ID ||
    !env.FHIR_MRN_IDENTIFIER_SYSTEM ||
    !env.FHIR_LAB_RESULT_IDENTIFIER_SYSTEM
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
  const patientResult = await processPendingPatientSyncTasks(prisma, {
    client,
    candidateId: env.FHIR_CANDIDATE_ID,
    mrnIdentifierSystem: env.FHIR_MRN_IDENTIFIER_SYSTEM,
  });
  const observationResult = await processPendingObservationSyncTasks(prisma, {
    client,
    candidateId: env.FHIR_CANDIDATE_ID,
    resultIdentifierSystem: env.FHIR_LAB_RESULT_IDENTIFIER_SYSTEM,
  });

  process.stdout.write(
    `FHIR synchronization complete: ${patientResult.succeeded} patients and ${observationResult.succeeded} observations succeeded; ${observationResult.deferred} observations deferred.\n`,
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
