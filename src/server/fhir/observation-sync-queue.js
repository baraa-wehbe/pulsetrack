const TASK_KEY_PREFIX = "observation-push:";

export const enqueueObservationSync = async (transaction, labResultId) => {
  const deduplicationKey = `${TASK_KEY_PREFIX}${labResultId}`;

  await transaction.fhirSyncTask.createMany({
    data: [
      {
        direction: "PUSH",
        trigger: "EVENT",
        resourceType: "OBSERVATION",
        operation: "CREATE",
        labResultId,
        deduplicationKey,
        status: "PENDING",
      },
    ],
    skipDuplicates: true,
  });
};

export const enqueueAcceptedObservationSyncs = async (
  prismaClient,
  importId,
) => {
  const accepted = await prismaClient.labImportRow.findMany({
    where: {
      importId,
      status: "ACCEPTED",
      labResultId: { not: null },
    },
    orderBy: { rowNumber: "asc" },
    select: { labResultId: true },
  });

  if (accepted.length === 0) return;

  try {
    await prismaClient.fhirSyncTask.createMany({
      data: accepted.map(({ labResultId }) => ({
        direction: "PUSH",
        trigger: "EVENT",
        resourceType: "OBSERVATION",
        operation: "CREATE",
        labResultId,
        deduplicationKey: `${TASK_KEY_PREFIX}${labResultId}`,
        status: "PENDING",
      })),
      skipDuplicates: true,
    });
  } catch {
    // The committed import remains authoritative. Reprocessing the import
    // retries this idempotent batch enqueue without exposing database details.
  }
};
