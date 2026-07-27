import "server-only";

import { processPendingObservationSyncTasks } from "@/server/fhir/observation-sync";
import { processPendingPatientSyncTasks } from "@/server/fhir/patient-sync";

export const FHIR_MAX_SYNC_ATTEMPTS = 5;

export const runFhirRetryJob = async (
  prismaClient,
  {
    client,
    candidateId,
    mrnIdentifierSystem,
    resultIdentifierSystem,
    limit = 25,
    now = () => new Date(),
    patientProcessor = processPendingPatientSyncTasks,
    observationProcessor = processPendingObservationSyncTasks,
  },
) => {
  const startedAt = now();
  const run = await prismaClient.fhirSyncRun.create({
    data: {
      direction: "PUSH",
      trigger: "CRON",
      scope: "ALL",
      status: "RUNNING",
      startedAt,
    },
    select: { id: true },
  });

  try {
    const patients = await patientProcessor(
      prismaClient,
      { candidateId, client, mrnIdentifierSystem },
      { limit, maxAttempts: FHIR_MAX_SYNC_ATTEMPTS, now },
    );
    const observations = await observationProcessor(
      prismaClient,
      { candidateId, client, resultIdentifierSystem },
      { limit, maxAttempts: FHIR_MAX_SYNC_ATTEMPTS, now },
    );
    const result = {
      discovered: patients.discovered + observations.discovered,
      succeeded: patients.succeeded + observations.succeeded,
      failed: patients.failed + observations.failed,
      skipped: patients.skipped + observations.skipped,
      deferred: observations.deferred,
    };
    const status =
      result.failed === 0
        ? "SUCCEEDED"
        : result.succeeded > 0 || result.skipped > 0 || result.deferred > 0
          ? "PARTIAL"
          : "FAILED";
    await prismaClient.fhirSyncRun.update({
      where: { id: run.id },
      data: {
        status,
        discoveredCount: result.discovered,
        succeededCount: result.succeeded,
        failedCount: result.failed,
        skippedCount: result.skipped + result.deferred,
        checkpoint: {
          deferredCount: result.deferred,
          processingOrder: ["PATIENT", "OBSERVATION"],
        },
        lastError:
          result.failed > 0
            ? "One or more synchronization tasks require review."
            : null,
        completedAt: now(),
      },
      select: { id: true },
    });
    return { status, ...result };
  } catch {
    await prismaClient.fhirSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        lastError: "FHIR retry processing failed safely.",
        completedAt: now(),
      },
      select: { id: true },
    });
    throw new Error("FHIR retry processing failed safely.");
  }
};
