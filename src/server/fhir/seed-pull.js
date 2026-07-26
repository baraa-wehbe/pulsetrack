import "server-only";

import { normalizePatientMrn } from "@/lib/patient-validation";

export const SEED_PATIENT_MRNS = Object.freeze([
  "MRN-2001",
  "MRN-2002",
  "MRN-2003",
  "MRN-2004",
  "MRN-2005",
]);

const FHIR_ID = /^[A-Za-z0-9.-]{1,64}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^[+-]?\d{1,8}(?:\.\d{1,4})?$/;
const SUPPORTED_OBSERVATION_STATUSES = new Set([
  "final",
  "amended",
  "corrected",
]);
const SEX = Object.freeze({
  male: "MALE",
  female: "FEMALE",
  other: "OTHER",
  unknown: "UNKNOWN",
});
const LOCAL_UNITS_BY_UCUM = Object.freeze({
  "mg/dL": "mg/dL",
  "%": "%",
  "mm[Hg]": "mmHg",
});
const SAFE_OUTCOMES = new Set([
  "NOT_FOUND",
  "MULTIPLE_PATIENT_MATCHES",
  "MALFORMED_PATIENT",
  "PATIENT_IDENTITY_CONFLICT",
  "CANDIDATE_OWNERSHIP_CONFLICT",
  "PROVIDER_FAILURE",
  "UNSUPPORTED_OBSERVATION",
  "MALFORMED_OBSERVATION",
  "OBSERVATION_IDENTITY_CONFLICT",
]);

export class SeedPullError extends Error {
  constructor(code) {
    super("FHIR seed pull could not safely process a resource.");
    this.name = "SeedPullError";
    this.code = SAFE_OUTCOMES.has(code) ? code : "PROVIDER_FAILURE";
  }
}

const validDateOnly = (value) => {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const versionId = (resource) => {
  const value = resource?.meta?.versionId;
  return typeof value === "string" && value.length <= 100 ? value : null;
};

const requiredIdentifier = (resource, system, expectedMrn) => {
  const values = Array.isArray(resource?.identifier)
    ? resource.identifier
        .filter((identifier) => identifier?.system === system)
        .map((identifier) => normalizePatientMrn(identifier?.value ?? ""))
        .filter(Boolean)
    : [];
  return values.includes(expectedMrn) ? expectedMrn : null;
};

export const mapFhirPatientForPull = (
  resource,
  expectedMrn,
  mrnIdentifierSystem,
) => {
  if (
    resource?.resourceType !== "Patient" ||
    !FHIR_ID.test(resource?.id ?? "") ||
    resource.active === false ||
    !requiredIdentifier(resource, mrnIdentifierSystem, expectedMrn) ||
    !validDateOnly(resource.birthDate)
  ) {
    throw new SeedPullError("MALFORMED_PATIENT");
  }
  const officialName =
    resource.name?.find((name) => name?.use === "official") ??
    resource.name?.[0];
  const firstName = officialName?.given?.[0]?.trim();
  const lastName = officialName?.family?.trim();
  if (
    !firstName ||
    firstName.length > 100 ||
    !lastName ||
    lastName.length > 100
  ) {
    throw new SeedPullError("MALFORMED_PATIENT");
  }
  const telecom = Array.isArray(resource.telecom) ? resource.telecom : [];
  const email = telecom.find((item) => item?.system === "email")?.value?.trim();
  const phone = telecom.find((item) => item?.system === "phone")?.value?.trim();
  if ((email && email.length > 320) || (phone && phone.length > 32)) {
    throw new SeedPullError("MALFORMED_PATIENT");
  }

  return {
    mrn: expectedMrn,
    firstName,
    lastName,
    dateOfBirth: new Date(`${resource.birthDate}T00:00:00.000Z`),
    sex: SEX[resource.gender] ?? "UNKNOWN",
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    origin: "FHIR",
    fhirResourceId: resource.id,
    fhirVersionId: versionId(resource),
    fhirOwnership: "EXTERNAL_READ_ONLY",
    fhirSyncStatus: "SYNCED",
    fhirLastSyncError: null,
  };
};

const catalogByLoinc = (catalog) =>
  new Map(catalog.map((test) => [test.loincCode, test]));

export const mapFhirObservationForPull = (
  resource,
  patientId,
  patientFhirResourceId,
  catalog,
  now,
) => {
  if (
    resource?.resourceType !== "Observation" ||
    !FHIR_ID.test(resource?.id ?? "") ||
    !SUPPORTED_OBSERVATION_STATUSES.has(resource.status) ||
    resource.subject?.reference !== `Patient/${patientFhirResourceId}`
  ) {
    throw new SeedPullError("MALFORMED_OBSERVATION");
  }
  const loinc = resource.code?.coding?.find(
    (coding) => coding?.system === "http://loinc.org",
  )?.code;
  const test = catalogByLoinc(catalog).get(loinc);
  const unit = LOCAL_UNITS_BY_UCUM[resource.valueQuantity?.code];
  if (!test || unit !== test.defaultUnit) {
    throw new SeedPullError("UNSUPPORTED_OBSERVATION");
  }
  const date = resource.effectiveDateTime?.slice(0, 10);
  const rawValue = String(resource.valueQuantity?.value ?? "");
  const value = Number(rawValue);
  if (
    !validDateOnly(date) ||
    date > now.toISOString().slice(0, 10) ||
    !DECIMAL.test(rawValue) ||
    !Number.isFinite(value)
  ) {
    throw new SeedPullError("MALFORMED_OBSERVATION");
  }

  return {
    patientId,
    testCode: test.code,
    collectedDate: new Date(`${date}T00:00:00.000Z`),
    value,
    unit: test.defaultUnit,
    refLow: test.defaultRefLow,
    refHigh: test.defaultRefHigh,
    source: "FHIR",
    fhirResourceId: resource.id,
    fhirVersionId: versionId(resource),
    fhirOwnership: "EXTERNAL_READ_ONLY",
    fhirSyncStatus: "SYNCED",
    fhirLastSyncedAt: now,
    fhirLastSyncError: null,
  };
};

export const upsertExternalPatient = async (prismaClient, mapped, now) =>
  prismaClient.$transaction(async (transaction) => {
    const [byFhirId, byMrn] = await Promise.all([
      transaction.patient.findUnique({
        where: { fhirResourceId: mapped.fhirResourceId },
      }),
      transaction.patient.findUnique({ where: { mrn: mapped.mrn } }),
    ]);
    if (byFhirId && byMrn && byFhirId.id !== byMrn.id) {
      throw new SeedPullError("PATIENT_IDENTITY_CONFLICT");
    }
    const existing = byFhirId ?? byMrn;
    if (existing?.fhirOwnership === "CANDIDATE_OWNED") {
      throw new SeedPullError("CANDIDATE_OWNERSHIP_CONFLICT");
    }
    if (
      existing?.fhirResourceId &&
      existing.fhirResourceId !== mapped.fhirResourceId
    ) {
      throw new SeedPullError("PATIENT_IDENTITY_CONFLICT");
    }
    const data = { ...mapped, fhirLastSyncedAt: now };
    return existing
      ? transaction.patient.update({
          where: { id: existing.id },
          data,
          select: { id: true, fhirResourceId: true },
        })
      : transaction.patient.create({
          data,
          select: { id: true, fhirResourceId: true },
        });
  });

export const upsertExternalObservation = async (prismaClient, mapped) =>
  prismaClient.$transaction(async (transaction) => {
    const [byFhirId, byIdentity] = await Promise.all([
      transaction.labResult.findUnique({
        where: { fhirResourceId: mapped.fhirResourceId },
      }),
      transaction.labResult.findUnique({
        where: {
          patientId_collectedDate_testCode: {
            patientId: mapped.patientId,
            collectedDate: mapped.collectedDate,
            testCode: mapped.testCode,
          },
        },
      }),
    ]);
    if (byFhirId && byIdentity && byFhirId.id !== byIdentity.id) {
      throw new SeedPullError("OBSERVATION_IDENTITY_CONFLICT");
    }
    const existing = byFhirId ?? byIdentity;
    if (byFhirId && byFhirId.patientId !== mapped.patientId) {
      throw new SeedPullError("OBSERVATION_IDENTITY_CONFLICT");
    }
    if (existing?.fhirOwnership === "CANDIDATE_OWNED") {
      throw new SeedPullError("CANDIDATE_OWNERSHIP_CONFLICT");
    }
    if (
      existing?.fhirResourceId &&
      existing.fhirResourceId !== mapped.fhirResourceId
    ) {
      throw new SeedPullError("OBSERVATION_IDENTITY_CONFLICT");
    }
    return existing
      ? transaction.labResult.update({
          where: { id: existing.id },
          data: mapped,
          select: { id: true },
        })
      : transaction.labResult.create({
          data: mapped,
          select: { id: true },
        });
  });

const patientSearch = (system, mrn) =>
  `Patient?identifier=${encodeURIComponent(`${system}|${mrn}`)}`;

const observationSearch = (fhirPatientId) =>
  `Observation?subject=${encodeURIComponent(`Patient/${fhirPatientId}`)}`;

const addOutcome = (outcomes, code) => {
  outcomes[code] = (outcomes[code] ?? 0) + 1;
};

export const pullSeedPatientsAndObservations = async (
  prismaClient,
  client,
  {
    mrnIdentifierSystem,
    now = () => new Date(),
    patientUpserter = upsertExternalPatient,
    observationUpserter = upsertExternalObservation,
  },
) => {
  const startedAt = now();
  const run = await prismaClient.fhirSyncRun.create({
    data: {
      direction: "PULL",
      trigger: "MANUAL",
      scope: "ALL",
      status: "RUNNING",
      startedAt,
    },
    select: { id: true },
  });
  const catalog = await prismaClient.labTest.findMany({
    where: { isActive: true },
    select: {
      code: true,
      loincCode: true,
      defaultUnit: true,
      defaultRefLow: true,
      defaultRefHigh: true,
    },
  });
  const counts = { discovered: 0, succeeded: 0, failed: 0, skipped: 0 };
  const outcomes = {};

  for (const mrn of SEED_PATIENT_MRNS) {
    let patientEntries;
    try {
      patientEntries = await client.getBundle(
        patientSearch(mrnIdentifierSystem, mrn),
      );
    } catch {
      counts.failed += 1;
      addOutcome(outcomes, "PROVIDER_FAILURE");
      continue;
    }
    const resources = patientEntries
      .map((entry) => entry?.resource)
      .filter(Boolean);
    counts.discovered += resources.length;
    if (resources.length === 0) {
      counts.skipped += 1;
      addOutcome(outcomes, "NOT_FOUND");
      continue;
    }
    if (resources.length !== 1) {
      counts.failed += 1;
      addOutcome(outcomes, "MULTIPLE_PATIENT_MATCHES");
      continue;
    }

    let patient;
    try {
      const mapped = mapFhirPatientForPull(
        resources[0],
        mrn,
        mrnIdentifierSystem,
      );
      patient = await patientUpserter(prismaClient, mapped, now());
      counts.succeeded += 1;
    } catch (error) {
      counts.failed += 1;
      addOutcome(
        outcomes,
        error instanceof SeedPullError ? error.code : "PROVIDER_FAILURE",
      );
      continue;
    }

    let observationEntries;
    try {
      observationEntries = await client.getBundle(
        observationSearch(patient.fhirResourceId),
      );
    } catch {
      counts.failed += 1;
      addOutcome(outcomes, "PROVIDER_FAILURE");
      continue;
    }
    counts.discovered += observationEntries.length;
    for (const entry of observationEntries) {
      try {
        const mapped = mapFhirObservationForPull(
          entry?.resource,
          patient.id,
          patient.fhirResourceId,
          catalog,
          now(),
        );
        await observationUpserter(prismaClient, mapped);
        counts.succeeded += 1;
      } catch (error) {
        const code =
          error instanceof SeedPullError ? error.code : "PROVIDER_FAILURE";
        if (
          code === "UNSUPPORTED_OBSERVATION" ||
          code === "MALFORMED_OBSERVATION"
        ) {
          counts.skipped += 1;
        } else {
          counts.failed += 1;
        }
        addOutcome(outcomes, code);
      }
    }
  }

  const status =
    counts.failed === 0
      ? "SUCCEEDED"
      : counts.succeeded > 0 || counts.skipped > 0
        ? "PARTIAL"
        : "FAILED";
  const completedAt = now();
  await prismaClient.fhirSyncRun.update({
    where: { id: run.id },
    data: {
      status,
      discoveredCount: counts.discovered,
      succeededCount: counts.succeeded,
      failedCount: counts.failed,
      skippedCount: counts.skipped,
      checkpoint: { outcomes },
      lastError:
        counts.failed > 0 ? "One or more FHIR resources require review." : null,
      completedAt,
    },
    select: { id: true },
  });

  return { status, ...counts, outcomes };
};
