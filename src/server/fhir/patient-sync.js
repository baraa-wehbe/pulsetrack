import "server-only";

import { mapPatientToFhir } from "@/server/fhir/mapping";

export { enqueuePatientSync } from "@/server/fhir/patient-sync-queue";

const SAFE_ERROR_MESSAGES = Object.freeze({
  ARCHIVED_PATIENT: "Archived patients are not synchronized.",
  EXTERNAL_OWNERSHIP: "The matching FHIR Patient is not candidate-owned.",
  MULTIPLE_MATCHES: "Multiple FHIR Patients matched the local identifier.",
  MALFORMED_RESOURCE: "The FHIR provider returned a malformed Patient.",
  REMOTE_RESOURCE_MISSING:
    "The previously linked FHIR Patient could not be confirmed.",
  PROVIDER_FAILURE: "FHIR synchronization failed and can be retried safely.",
});

export class PatientSyncError extends Error {
  constructor(code) {
    super(SAFE_ERROR_MESSAGES[code] ?? SAFE_ERROR_MESSAGES.PROVIDER_FAILURE);
    this.name = "PatientSyncError";
    this.code = SAFE_ERROR_MESSAGES[code] ? code : "PROVIDER_FAILURE";
  }
}

const hasOwnedIdentifier = (resource, system, mrn) =>
  Array.isArray(resource?.identifier) &&
  resource.identifier.some(
    (identifier) => identifier?.system === system && identifier?.value === mrn,
  );

const requireOwnedPatient = (resource, system, mrn) => {
  if (
    resource?.resourceType !== "Patient" ||
    typeof resource.id !== "string" ||
    !/^[A-Za-z0-9.-]{1,64}$/.test(resource.id)
  ) {
    throw new PatientSyncError("MALFORMED_RESOURCE");
  }
  if (!hasOwnedIdentifier(resource, system, mrn)) {
    throw new PatientSyncError("EXTERNAL_OWNERSHIP");
  }
  return resource;
};

const providerVersion = (resource) => {
  const version = resource?.meta?.versionId;
  return typeof version === "string" && version.length <= 100 ? version : null;
};

const searchPath = (system, mrn) =>
  `Patient?identifier=${encodeURIComponent(`${system}|${mrn}`)}`;

const conditionalIdentifier = (system, mrn) =>
  `identifier=${encodeURIComponent(`${system}|${mrn}`)}`;

const synchronizePatient = async ({ client, mrnIdentifierSystem, patient }) => {
  if (patient.archivedAt) throw new PatientSyncError("ARCHIVED_PATIENT");
  if (patient.fhirOwnership === "EXTERNAL_READ_ONLY") {
    throw new PatientSyncError("EXTERNAL_OWNERSHIP");
  }

  let entries;
  try {
    entries = await client.getBundle(
      searchPath(mrnIdentifierSystem, patient.mrn),
    );
  } catch (error) {
    if (error instanceof PatientSyncError) throw error;
    throw new PatientSyncError("PROVIDER_FAILURE");
  }

  const matches = entries.map((entry) => entry?.resource).filter(Boolean);
  if (matches.length > 1) throw new PatientSyncError("MULTIPLE_MATCHES");

  if (matches.length === 1) {
    const remote = requireOwnedPatient(
      matches[0],
      mrnIdentifierSystem,
      patient.mrn,
    );
    if (patient.fhirResourceId && patient.fhirResourceId !== remote.id) {
      throw new PatientSyncError("EXTERNAL_OWNERSHIP");
    }

    const mapped = mapPatientToFhir(
      { ...patient, fhirResourceId: remote.id },
      { mrnIdentifierSystem },
    );
    let updated;
    try {
      updated = await client.put(`Patient/${remote.id}`, mapped);
    } catch {
      throw new PatientSyncError("PROVIDER_FAILURE");
    }
    return requireOwnedPatient(updated, mrnIdentifierSystem, patient.mrn);
  }

  if (patient.fhirResourceId) {
    throw new PatientSyncError("REMOTE_RESOURCE_MISSING");
  }

  const mapped = mapPatientToFhir(patient, { mrnIdentifierSystem });
  let created;
  try {
    created = await client.post("Patient", mapped, {
      ifNoneExist: conditionalIdentifier(mrnIdentifierSystem, patient.mrn),
    });
  } catch {
    throw new PatientSyncError("PROVIDER_FAILURE");
  }
  return requireOwnedPatient(created, mrnIdentifierSystem, patient.mrn);
};

const patientSelect = Object.freeze({
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  email: true,
  phone: true,
  archivedAt: true,
  updatedAt: true,
  fhirResourceId: true,
  fhirOwnership: true,
});

const retryDelay = (attempts) =>
  Math.min(60 * 60 * 1000, 30 * 1000 * 2 ** Math.min(attempts - 1, 7));

export const processPatientSyncTask = async (
  prismaClient,
  taskId,
  { client, mrnIdentifierSystem, maxAttempts = 5, now = () => new Date() },
) => {
  const claimedAt = now();
  const staleBefore = new Date(claimedAt.getTime() - 10 * 60 * 1000);
  const claimed = await prismaClient.fhirSyncTask.updateMany({
    where: {
      id: taskId,
      resourceType: "PATIENT",
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
      patient: { select: patientSelect },
    },
  });

  if (!task?.patient) {
    return { processed: false, skipped: true };
  }

  try {
    const remote = await synchronizePatient({
      client,
      mrnIdentifierSystem,
      patient: task.patient,
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

      await transaction.patient.update({
        where: { id: task.patient.id },
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
    const safe =
      error instanceof PatientSyncError
        ? error
        : new PatientSyncError("PROVIDER_FAILURE");
    const failedAt = now();
    await prismaClient.$transaction(async (transaction) => {
      const failed = await transaction.fhirSyncTask.updateMany({
        where: { id: task.id, status: "PROCESSING", lockedAt: claimedAt },
        data: {
          status: "FAILED",
          lockedAt: null,
          nextAttemptAt: new Date(
            failedAt.getTime() + retryDelay(task.attempts),
          ),
          lastErrorCode: safe.code,
          lastErrorMessage: safe.message,
        },
      });
      if (failed.count !== 1) return;
      await transaction.patient.update({
        where: { id: task.patient.id },
        data: {
          fhirSyncStatus: "FAILED",
          fhirLastSyncError: safe.message,
        },
        select: { id: true },
      });
    });
    return { processed: true, succeeded: false, errorCode: safe.code };
  }
};

export const processPendingPatientSyncTasks = async (
  prismaClient,
  options,
  { limit = 25, maxAttempts = 5, now = () => new Date() } = {},
) => {
  const current = now();
  const tasks = await prismaClient.fhirSyncTask.findMany({
    where: {
      resourceType: "PATIENT",
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
      await processPatientSyncTask(prismaClient, task.id, {
        ...options,
        maxAttempts,
        now,
      }),
    );
  }
  return {
    discovered: tasks.length,
    succeeded: results.filter((result) => result.succeeded).length,
    failed: results.filter((result) => result.processed && !result.succeeded)
      .length,
    skipped: results.filter((result) => result.skipped).length,
  };
};
