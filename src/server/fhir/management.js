import "server-only";

import { enqueueObservationSync } from "@/server/fhir/observation-sync-queue";
import { enqueuePatientSync } from "@/server/fhir/patient-sync-queue";
import { FHIR_MAX_SYNC_ATTEMPTS } from "@/server/fhir/retry-job";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const identifierWhere = (identifier) =>
  UUID_PATTERN.test(identifier)
    ? { id: identifier.toLowerCase() }
    : { mrn: identifier.trim().toUpperCase() };

export class FhirManagementError extends Error {
  constructor(code) {
    super("FHIR action could not be completed.");
    this.name = "FhirManagementError";
    this.code = code;
  }
}

const safeTaskMessage = (code) =>
  ({
    PROVIDER_FAILURE: "FHIR synchronization failed and can be retried safely.",
    PATIENT_SYNC_PENDING: "Patient synchronization must complete first.",
    PATIENT_OWNERSHIP_CONFLICT:
      "The related FHIR Patient is not candidate-owned.",
    EXTERNAL_OWNERSHIP: "The matching FHIR Patient is not candidate-owned.",
    MULTIPLE_MATCHES: "Multiple remote resources require review.",
    MALFORMED_RESOURCE: "The FHIR provider returned a malformed resource.",
    REMOTE_RESOURCE_MISSING:
      "The previously linked remote resource could not be confirmed.",
    OBSERVATION_OWNERSHIP_CONFLICT:
      "The matching FHIR Observation is not candidate-owned.",
  })[code] ?? "Synchronization failed safely.";

export const requestPatientSynchronization = async (
  prismaClient,
  identifier,
  now = new Date(),
) => {
  const patient = await prismaClient.patient.findFirst({
    where: { ...identifierWhere(identifier), archivedAt: null },
    select: {
      id: true,
      fhirOwnership: true,
      labResults: {
        where: { fhirOwnership: { not: "EXTERNAL_READ_ONLY" } },
        select: { id: true },
      },
    },
  });
  if (!patient) throw new FhirManagementError("NOT_FOUND");
  if (patient.fhirOwnership === "EXTERNAL_READ_ONLY") {
    throw new FhirManagementError("READ_ONLY");
  }

  await prismaClient.$transaction(async (transaction) => {
    await enqueuePatientSync(transaction, patient.id, "UPDATE");
    for (const result of patient.labResults) {
      await enqueueObservationSync(transaction, result.id);
    }
    await transaction.fhirSyncTask.updateMany({
      where: {
        OR: [
          { patientId: patient.id },
          { labResultId: { in: patient.labResults.map(({ id }) => id) } },
        ],
        status: { in: ["FAILED", "SKIPPED"] },
        attempts: { lt: FHIR_MAX_SYNC_ATTEMPTS },
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
  });

  await prismaClient.fhirSyncRun.create({
    data: {
      direction: "PUSH",
      trigger: "MANUAL",
      scope: "PATIENT",
      status: "SUCCEEDED",
      discoveredCount: 1 + patient.labResults.length,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      checkpoint: { outcome: "QUEUED" },
      startedAt: now,
      completedAt: now,
    },
    select: { id: true },
  });
  return { status: "PENDING", queued: 1 + patient.labResults.length };
};

export const checkPatientRemoteStatus = async (
  prismaClient,
  client,
  identifier,
  mrnIdentifierSystem,
) => {
  const patient = await prismaClient.patient.findFirst({
    where: { ...identifierWhere(identifier), archivedAt: null },
    select: {
      mrn: true,
      fhirResourceId: true,
      fhirOwnership: true,
      fhirSyncStatus: true,
    },
  });
  if (!patient) throw new FhirManagementError("NOT_FOUND");

  let entries;
  try {
    entries = await client.getBundle(
      `Patient?identifier=${encodeURIComponent(`${mrnIdentifierSystem}|${patient.mrn}`)}`,
    );
  } catch {
    return {
      remoteStatus: "UNAVAILABLE",
      localSyncStatus: patient.fhirSyncStatus,
      ownership: patient.fhirOwnership,
    };
  }
  const resources = entries.map((entry) => entry?.resource).filter(Boolean);
  const remoteStatus =
    resources.length === 0
      ? "MISSING"
      : resources.length > 1
        ? "AMBIGUOUS"
        : patient.fhirResourceId && resources[0]?.id !== patient.fhirResourceId
          ? "MISMATCH"
          : "MATCHED";
  return {
    remoteStatus,
    localSyncStatus: patient.fhirSyncStatus,
    ownership: patient.fhirOwnership,
  };
};

export const listFhirSyncActivity = async (prismaClient, now = new Date()) => {
  const [runs, failures] = await Promise.all([
    prismaClient.fhirSyncRun.findMany({
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        direction: true,
        trigger: true,
        scope: true,
        status: true,
        discoveredCount: true,
        succeededCount: true,
        failedCount: true,
        skippedCount: true,
        startedAt: true,
        completedAt: true,
        lastError: true,
      },
    }),
    prismaClient.fhirSyncTask.findMany({
      where: { status: "FAILED" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        resourceType: true,
        attempts: true,
        nextAttemptAt: true,
        lastErrorCode: true,
        updatedAt: true,
        patientId: true,
        labResultId: true,
      },
    }),
  ]);
  return {
    runs: runs.map((run) => ({
      ...run,
      lastError: run.lastError
        ? "One or more synchronization tasks require review."
        : null,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    })),
    failures: failures.map((task) => ({
      resourceType: task.resourceType,
      attempts: task.attempts,
      nextAttemptAt: task.nextAttemptAt?.toISOString() ?? null,
      retryEligible:
        task.attempts < FHIR_MAX_SYNC_ATTEMPTS &&
        (!task.nextAttemptAt || task.nextAttemptAt <= now),
      errorCode: task.lastErrorCode ?? "UNKNOWN",
      errorMessage: safeTaskMessage(task.lastErrorCode),
      updatedAt: task.updatedAt.toISOString(),
      context: task.labResultId
        ? "LAB_RESULT"
        : task.patientId
          ? "PATIENT"
          : "UNKNOWN",
    })),
  };
};
