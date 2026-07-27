import "server-only";

import { runFhirRetryJob } from "@/server/fhir/retry-job";
import { pullSeedPatientsAndObservations } from "@/server/fhir/seed-pull";

export const runFullFhirSynchronization = async (
  prismaClient,
  client,
  configuration,
  { pull = pullSeedPatientsAndObservations, push = runFhirRetryJob } = {},
) => {
  await prismaClient.fhirSyncTask.updateMany({
    where: {
      status: "FAILED",
      attempts: { lt: 5 },
    },
    data: {
      status: "PENDING",
      nextAttemptAt: null,
      lockedAt: null,
      completedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  const pushed = await push(prismaClient, {
    candidateId: configuration.candidateId,
    client,
    mrnIdentifierSystem: configuration.mrnIdentifierSystem,
    resultIdentifierSystem: configuration.resultIdentifierSystem,
  });
  const imported = await pull(prismaClient, client, {
    mrnIdentifierSystem: configuration.mrnIdentifierSystem,
  });

  const status =
    pushed.status === "FAILED" && imported.status === "FAILED"
      ? "FAILED"
      : pushed.status === "SUCCEEDED" && imported.status === "SUCCEEDED"
        ? "SUCCEEDED"
        : "PARTIAL";

  return {
    status,
    pushed: {
      succeeded: pushed.succeeded,
      failed: pushed.failed,
      skipped: pushed.skipped + (pushed.deferred ?? 0),
    },
    imported: {
      succeeded: imported.succeeded,
      failed: imported.failed,
      skipped: imported.skipped,
    },
  };
};
