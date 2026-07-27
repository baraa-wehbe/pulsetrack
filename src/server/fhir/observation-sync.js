import "server-only";

import { mapLabResultToFhirObservation } from "@/server/fhir/mapping";
import { enqueuePatientSync } from "@/server/fhir/patient-sync-queue";

const SAFE_ERRORS = Object.freeze({
  RESULT_NOT_FOUND: "The local lab result is no longer available.",
  PATIENT_NOT_ACTIVE: "The related patient is not active.",
  PATIENT_SYNC_PENDING: "Patient synchronization must complete first.",
  PATIENT_OWNERSHIP_CONFLICT:
    "The related FHIR Patient is not candidate-owned.",
  MULTIPLE_MATCHES: "Multiple FHIR Observations matched the local identifier.",
  OBSERVATION_OWNERSHIP_CONFLICT:
    "The matching FHIR Observation is not candidate-owned.",
  MALFORMED_RESOURCE: "The FHIR provider returned a malformed Observation.",
  REMOTE_RESOURCE_MISSING:
    "The previously linked FHIR Observation could not be confirmed.",
  PROVIDER_FAILURE: "FHIR synchronization failed and can be retried safely.",
});

export class ObservationSyncError extends Error {
  constructor(code) {
    super(SAFE_ERRORS[code] ?? SAFE_ERRORS.PROVIDER_FAILURE);
    this.name = "ObservationSyncError";
    this.code = SAFE_ERRORS[code] ? code : "PROVIDER_FAILURE";
  }
}

const hasOwnedIdentifier = (resource, system, value) =>
  Array.isArray(resource?.identifier) &&
  resource.identifier.some(
    (identifier) =>
      identifier?.system === system && identifier?.value === value,
  );

const hasCandidateOwnershipTag = (resource, candidateId) =>
  typeof candidateId === "string" &&
  candidateId.length > 0 &&
  Array.isArray(resource?.meta?.tag) &&
  resource.meta.tag.some((tag) => tag?.code === candidateId);

const requireOwnedObservation = (resource, system, localId, candidateId) => {
  if (
    resource?.resourceType !== "Observation" ||
    typeof resource.id !== "string" ||
    !/^[A-Za-z0-9.-]{1,64}$/.test(resource.id)
  ) {
    throw new ObservationSyncError("MALFORMED_RESOURCE");
  }
  if (
    !hasOwnedIdentifier(resource, system, localId) ||
    !hasCandidateOwnershipTag(resource, candidateId)
  ) {
    throw new ObservationSyncError("OBSERVATION_OWNERSHIP_CONFLICT");
  }
  return resource;
};

const providerVersion = (resource) => {
  const value = resource?.meta?.versionId;
  return typeof value === "string" && value.length <= 100 ? value : null;
};

const retryDelay = (attempts) =>
  Math.min(60 * 60 * 1000, 30 * 1000 * 2 ** Math.min(attempts - 1, 7));

const searchPath = (system, localId) =>
  `Observation?identifier=${encodeURIComponent(`${system}|${localId}`)}`;

const conditionalIdentifier = (system, localId) =>
  `identifier=${encodeURIComponent(`${system}|${localId}`)}`;

const resultSelect = Object.freeze({
  id: true,
  collectedDate: true,
  value: true,
  fhirResourceId: true,
  patient: {
    select: {
      id: true,
      archivedAt: true,
      fhirResourceId: true,
      fhirOwnership: true,
      fhirSyncStatus: true,
    },
  },
  test: {
    select: {
      code: true,
      name: true,
      loincCode: true,
      defaultUnit: true,
      defaultRefLow: true,
      defaultRefHigh: true,
    },
  },
});

const pushObservation = async ({
  candidateId,
  client,
  labResult,
  resultIdentifierSystem,
}) => {
  let entries;
  try {
    entries = await client.getBundle(
      searchPath(resultIdentifierSystem, labResult.id),
    );
  } catch {
    throw new ObservationSyncError("PROVIDER_FAILURE");
  }
  const matches = entries.map((entry) => entry?.resource).filter(Boolean);
  if (matches.length > 1) {
    throw new ObservationSyncError("MULTIPLE_MATCHES");
  }

  if (matches.length === 1) {
    const remote = requireOwnedObservation(
      matches[0],
      resultIdentifierSystem,
      labResult.id,
      candidateId,
    );
    if (labResult.fhirResourceId && labResult.fhirResourceId !== remote.id) {
      throw new ObservationSyncError("OBSERVATION_OWNERSHIP_CONFLICT");
    }
    const mapped = mapLabResultToFhirObservation(
      { ...labResult, fhirResourceId: remote.id },
      labResult.test,
      {
        resultIdentifierSystem,
        patientFhirResourceId: labResult.patient.fhirResourceId,
      },
    );
    try {
      return requireOwnedObservation(
        await client.put(`Observation/${remote.id}`, mapped),
        resultIdentifierSystem,
        labResult.id,
        candidateId,
      );
    } catch (error) {
      if (error instanceof ObservationSyncError) throw error;
      throw new ObservationSyncError("PROVIDER_FAILURE");
    }
  }

  if (labResult.fhirResourceId) {
    throw new ObservationSyncError("REMOTE_RESOURCE_MISSING");
  }
  const mapped = mapLabResultToFhirObservation(labResult, labResult.test, {
    resultIdentifierSystem,
    patientFhirResourceId: labResult.patient.fhirResourceId,
  });
  try {
    return requireOwnedObservation(
      await client.post("Observation", mapped, {
        ifNoneExist: conditionalIdentifier(
          resultIdentifierSystem,
          labResult.id,
        ),
      }),
      resultIdentifierSystem,
      labResult.id,
      candidateId,
    );
  } catch (error) {
    if (error instanceof ObservationSyncError) throw error;
    throw new ObservationSyncError("PROVIDER_FAILURE");
  }
};

export const processObservationSyncTask = async (
  prismaClient,
  taskId,
  {
    candidateId,
    client,
    resultIdentifierSystem,
    maxAttempts = 5,
    now = () => new Date(),
  },
) => {
  const claimedAt = now();
  const staleBefore = new Date(claimedAt.getTime() - 10 * 60 * 1000);
  const claimed = await prismaClient.fhirSyncTask.updateMany({
    where: {
      id: taskId,
      resourceType: "OBSERVATION",
      attempts: { lt: maxAttempts },
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", lockedAt: { lt: staleBefore } },
      ],
      AND: [
        {
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: claimedAt } }],
        },
      ],
    },
    data: {
      status: "PROCESSING",
      lockedAt: claimedAt,
      attempts: { increment: 1 },
    },
  });
  if (claimed.count !== 1) return { processed: false, skipped: true };

  const task = await prismaClient.fhirSyncTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      attempts: true,
      labResult: { select: resultSelect },
    },
  });
  if (!task?.labResult) {
    return { processed: false, skipped: true };
  }

  const patient = task.labResult.patient;
  if (patient.archivedAt) {
    return failTask(prismaClient, task, claimedAt, now, "PATIENT_NOT_ACTIVE");
  }
  if (
    patient.fhirOwnership === "EXTERNAL_READ_ONLY" ||
    (patient.fhirOwnership === "CANDIDATE_OWNED" && !patient.fhirResourceId)
  ) {
    return failTask(
      prismaClient,
      task,
      claimedAt,
      now,
      "PATIENT_OWNERSHIP_CONFLICT",
    );
  }
  if (
    patient.fhirOwnership !== "CANDIDATE_OWNED" ||
    !patient.fhirResourceId ||
    patient.fhirSyncStatus !== "SYNCED"
  ) {
    await prismaClient.$transaction(async (transaction) => {
      await enqueuePatientSync(transaction, patient.id, "UPDATE");
      await transaction.fhirSyncTask.updateMany({
        where: { id: task.id, status: "PROCESSING", lockedAt: claimedAt },
        data: {
          status: "PENDING",
          lockedAt: null,
          nextAttemptAt: new Date(now().getTime() + 30_000),
          lastErrorCode: "PATIENT_SYNC_PENDING",
          lastErrorMessage: SAFE_ERRORS.PATIENT_SYNC_PENDING,
        },
      });
    });
    return { processed: true, deferred: true };
  }

  try {
    const remote = await pushObservation({
      candidateId,
      client,
      labResult: task.labResult,
      resultIdentifierSystem,
    });
    const completedAt = now();
    await prismaClient.$transaction(async (transaction) => {
      const completed = await transaction.fhirSyncTask.updateMany({
        where: { id: task.id, status: "PROCESSING", lockedAt: claimedAt },
        data: {
          status: "SUCCEEDED",
          fhirResourceId: remote.id,
          completedAt,
          lockedAt: null,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      if (completed.count !== 1) return;
      await transaction.labResult.update({
        where: { id: task.labResult.id },
        data: {
          fhirResourceId: remote.id,
          fhirVersionId: providerVersion(remote),
          fhirOwnership: "CANDIDATE_OWNED",
          fhirSyncStatus: "SYNCED",
          fhirLastSyncedAt: completedAt,
          fhirLastSyncError: null,
        },
        select: { id: true },
      });
    });
    return { processed: true, succeeded: true };
  } catch (error) {
    const code =
      error instanceof ObservationSyncError ? error.code : "PROVIDER_FAILURE";
    return failTask(prismaClient, task, claimedAt, now, code);
  }
};

const failTask = async (prismaClient, task, claimedAt, now, code) => {
  const safe = new ObservationSyncError(code);
  const failedAt = now();
  await prismaClient.$transaction(async (transaction) => {
    const failed = await transaction.fhirSyncTask.updateMany({
      where: { id: task.id, status: "PROCESSING", lockedAt: claimedAt },
      data: {
        status: "FAILED",
        lockedAt: null,
        nextAttemptAt: new Date(failedAt.getTime() + retryDelay(task.attempts)),
        lastErrorCode: safe.code,
        lastErrorMessage: safe.message,
      },
    });
    if (failed.count !== 1) return;
    await transaction.labResult.update({
      where: { id: task.labResult.id },
      data: {
        fhirSyncStatus: "FAILED",
        fhirLastSyncError: safe.message,
      },
      select: { id: true },
    });
  });
  return { processed: true, succeeded: false, errorCode: safe.code };
};

export const processPendingObservationSyncTasks = async (
  prismaClient,
  options,
  { limit = 25, maxAttempts = 5, now = () => new Date() } = {},
) => {
  const current = now();
  const tasks = await prismaClient.fhirSyncTask.findMany({
    where: {
      resourceType: "OBSERVATION",
      attempts: { lt: maxAttempts },
      OR: [
        {
          AND: [
            { status: { in: ["PENDING", "FAILED"] } },
            {
              OR: [
                { nextAttemptAt: null },
                { nextAttemptAt: { lte: current } },
              ],
            },
          ],
        },
        {
          status: "PROCESSING",
          lockedAt: { lt: new Date(current.getTime() - 10 * 60 * 1000) },
        },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true },
  });
  const results = [];
  for (const task of tasks) {
    results.push(
      await processObservationSyncTask(prismaClient, task.id, {
        ...options,
        maxAttempts,
        now,
      }),
    );
  }
  return {
    discovered: tasks.length,
    succeeded: results.filter((result) => result.succeeded).length,
    deferred: results.filter((result) => result.deferred).length,
    failed: results.filter(
      (result) => result.processed && !result.succeeded && !result.deferred,
    ).length,
    skipped: results.filter((result) => result.skipped).length,
  };
};
