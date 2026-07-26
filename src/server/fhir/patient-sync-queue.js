const TASK_KEY_PREFIX = "patient-push:";

export const enqueuePatientSync = async (transaction, patientId, operation) => {
  const deduplicationKey = `${TASK_KEY_PREFIX}${patientId}`;

  await transaction.fhirSyncTask.upsert({
    where: { deduplicationKey },
    create: {
      direction: "PUSH",
      trigger: "EVENT",
      resourceType: "PATIENT",
      operation,
      patientId,
      deduplicationKey,
      status: "PENDING",
    },
    update: {
      operation,
      status: "PENDING",
      nextAttemptAt: null,
      lockedAt: null,
      completedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    select: { id: true },
  });
};
