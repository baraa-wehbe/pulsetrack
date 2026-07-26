import {
  PATIENT_DETAIL_SELECT,
  PATIENT_LIST_SELECT,
  PATIENT_SAFE_SELECT,
  toDateOnly,
  toSafeActivePatientDetail,
  toSafePatient,
  toSafePatientListItem,
} from "@/server/patients/serialization";
import {
  normalizePatientMrn,
  PATIENT_LIST_ALL,
  PATIENT_LIST_DEFAULTS,
} from "@/lib/patient-validation";
import { enqueuePatientSync } from "@/server/fhir/patient-sync-queue";

export const PATIENT_AUDIT_ACTIONS = Object.freeze({
  create: "PATIENT_CREATED",
  update: "PATIENT_UPDATED",
  archive: "PATIENT_ARCHIVED",
});

const EDITABLE_FIELDS = Object.freeze([
  "mrn",
  "firstName",
  "lastName",
  "dateOfBirth",
  "sex",
  "email",
  "phone",
]);

export class PatientServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PatientServiceError";
    this.code = code;
  }
}

export const isMrnUniqueConstraintError = (error) => {
  if (!error || typeof error !== "object" || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const constraint = error.meta?.constraint;
  const serializedMetadata = JSON.stringify(error.meta ?? {});

  return (
    (Array.isArray(target) && target.includes("mrn")) ||
    (typeof target === "string" && target.includes("mrn")) ||
    constraint === "patients_mrn_key" ||
    /"mrn"/i.test(serializedMetadata)
  );
};

const toDatabaseDate = (dateOnly) => new Date(`${dateOnly}T00:00:00.000Z`);

const defaultAuditWriter = (transaction, data) =>
  transaction.auditLog.create({
    data,
    select: { id: true },
  });

const auditData = ({ action, actorId, patientId, metadata }) => ({
  actorType: "CLINICIAN",
  clinicianId: actorId,
  action,
  entityType: "PATIENT",
  entityId: patientId,
  metadata,
});

export const PATIENT_LIST_ORDER = Object.freeze([
  { lastName: "asc" },
  { firstName: "asc" },
  { mrn: "asc" },
  { id: "asc" },
]);

export const buildActivePatientWhere = ({
  search,
  origin,
  ownership,
  syncStatus,
}) => {
  const filters = [{ archivedAt: null }];
  const searchTokens = search.split(/\s+/).filter(Boolean);

  for (const token of searchTokens) {
    filters.push({
      OR: [
        { mrn: { contains: token.toUpperCase() } },
        { firstName: { contains: token, mode: "insensitive" } },
        { lastName: { contains: token, mode: "insensitive" } },
      ],
    });
  }

  if (origin !== PATIENT_LIST_ALL) filters.push({ origin });
  if (ownership !== PATIENT_LIST_ALL) {
    filters.push({ fhirOwnership: ownership });
  }
  if (syncStatus !== PATIENT_LIST_ALL) {
    filters.push({ fhirSyncStatus: syncStatus });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
};

export const listActivePatients = async (
  prismaClient,
  query = PATIENT_LIST_DEFAULTS,
) => {
  const where = buildActivePatientWhere(query);

  return prismaClient.$transaction(
    async (transaction) => {
      const [totalCount, activePatientCount] = await Promise.all([
        transaction.patient.count({ where }),
        transaction.patient.count({ where: { archivedAt: null } }),
      ]);
      const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
      const page = Math.min(query.page, totalPages);
      const patients = await transaction.patient.findMany({
        where,
        orderBy: PATIENT_LIST_ORDER,
        skip: (page - 1) * query.pageSize,
        take: query.pageSize,
        select: PATIENT_LIST_SELECT,
      });

      return {
        patients: patients.map(toSafePatientListItem),
        activePatientCount,
        query: { ...query, page },
        pagination: {
          page,
          pageSize: query.pageSize,
          totalCount,
          totalPages,
          hasPreviousPage: page > 1,
          hasNextPage: page < totalPages,
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
};

export const getPatientById = async (prismaClient, patientId) => {
  const patient = await prismaClient.patient.findUnique({
    where: { id: patientId },
    select: PATIENT_SAFE_SELECT,
  });

  return patient ? toSafePatient(patient) : null;
};

export const getActivePatientDetailByIdentifier = async (
  prismaClient,
  identifier,
) => {
  const patient = await prismaClient.patient.findFirst({
    where: {
      ...patientIdentifierWhere(identifier),
      archivedAt: null,
    },
    select: PATIENT_DETAIL_SELECT,
  });

  return patient ? toSafeActivePatientDetail(patient) : null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const patientIdentifierWhere = (identifier) =>
  UUID_PATTERN.test(identifier)
    ? {
        OR: [
          { id: identifier.toLowerCase() },
          { mrn: normalizePatientMrn(identifier) },
        ],
      }
    : { mrn: normalizePatientMrn(identifier) };

export const getActivePatientDetailByMrn = getActivePatientDetailByIdentifier;

export const getPatientByIdentifier = async (prismaClient, identifier) => {
  const patient = await prismaClient.patient.findFirst({
    where: patientIdentifierWhere(identifier),
    select: PATIENT_SAFE_SELECT,
  });

  return patient ? toSafePatient(patient) : null;
};

export const createPatient = async (
  prismaClient,
  actorId,
  input,
  { auditWriter = defaultAuditWriter, syncEnqueuer = enqueuePatientSync } = {},
) => {
  try {
    const patient = await prismaClient.$transaction(async (transaction) => {
      const createdPatient = await transaction.patient.create({
        data: {
          mrn: input.mrn,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: toDatabaseDate(input.dateOfBirth),
          sex: input.sex,
          email: input.email,
          phone: input.phone,
          createdById: actorId,
          fhirSyncStatus: "PENDING",
          fhirLastSyncError: null,
        },
        select: PATIENT_SAFE_SELECT,
      });

      await auditWriter(
        transaction,
        auditData({
          action: PATIENT_AUDIT_ACTIONS.create,
          actorId,
          patientId: createdPatient.id,
          metadata: {
            changedFields: EDITABLE_FIELDS.filter(
              (field) => input[field] !== null,
            ),
          },
        }),
      );

      await syncEnqueuer(transaction, createdPatient.id, "CREATE");

      return createdPatient;
    });

    return toSafePatient(patient);
  } catch (error) {
    if (isMrnUniqueConstraintError(error)) {
      throw new PatientServiceError(
        "MRN_CONFLICT",
        "A patient with this MRN already exists.",
      );
    }

    throw error;
  }
};

const comparableValue = (patient, field) =>
  field === "dateOfBirth" ? toDateOnly(patient[field]) : patient[field];

export const updatePatient = async (
  prismaClient,
  actorId,
  patientId,
  input,
  { auditWriter = defaultAuditWriter, syncEnqueuer = enqueuePatientSync } = {},
) => {
  try {
    const result = await prismaClient.$transaction(async (transaction) => {
      const existingPatient = await transaction.patient.findFirst({
        where: patientIdentifierWhere(patientId),
        select: PATIENT_SAFE_SELECT,
      });

      if (!existingPatient) {
        throw new PatientServiceError("NOT_FOUND", "Patient not found.");
      }

      if (existingPatient.archivedAt) {
        throw new PatientServiceError(
          "ARCHIVED",
          "Archived patients cannot be edited.",
        );
      }

      const changedFields = EDITABLE_FIELDS.filter(
        (field) =>
          Object.hasOwn(input, field) &&
          input[field] !== comparableValue(existingPatient, field),
      );

      if (changedFields.length === 0) {
        return { patient: existingPatient, changed: false };
      }

      const changes = Object.fromEntries(
        changedFields.map((field) => [
          field,
          {
            from: comparableValue(existingPatient, field),
            to: input[field],
          },
        ]),
      );
      const data = Object.fromEntries(
        changedFields.map((field) => [
          field,
          field === "dateOfBirth" ? toDatabaseDate(input[field]) : input[field],
        ]),
      );
      data.fhirSyncStatus = "PENDING";
      data.fhirLastSyncError = null;
      const updatedPatient = await transaction.patient.update({
        where: { id: existingPatient.id },
        data,
        select: PATIENT_SAFE_SELECT,
      });

      await auditWriter(
        transaction,
        auditData({
          action: PATIENT_AUDIT_ACTIONS.update,
          actorId,
          patientId: existingPatient.id,
          metadata: { changedFields, changes },
        }),
      );

      await syncEnqueuer(transaction, updatedPatient.id, "UPDATE");

      return { patient: updatedPatient, changed: true };
    });

    return {
      patient: toSafePatient(result.patient),
      changed: result.changed,
    };
  } catch (error) {
    if (isMrnUniqueConstraintError(error)) {
      throw new PatientServiceError(
        "MRN_CONFLICT",
        "A patient with this MRN already exists.",
      );
    }

    throw error;
  }
};

export const archivePatient = async (
  prismaClient,
  actorId,
  patientId,
  { auditWriter = defaultAuditWriter, now = () => new Date() } = {},
) => {
  const result = await prismaClient.$transaction(async (transaction) => {
    const existingPatient = await transaction.patient.findFirst({
      where: patientIdentifierWhere(patientId),
      select: PATIENT_SAFE_SELECT,
    });

    if (!existingPatient) {
      throw new PatientServiceError("NOT_FOUND", "Patient not found.");
    }

    if (existingPatient.archivedAt) {
      return { patient: existingPatient, alreadyArchived: true };
    }

    const archivedAt = now();
    const archivedPatient = await transaction.patient.update({
      where: { id: existingPatient.id },
      data: { archivedAt },
      select: PATIENT_SAFE_SELECT,
    });

    await auditWriter(
      transaction,
      auditData({
        action: PATIENT_AUDIT_ACTIONS.archive,
        actorId,
        patientId: existingPatient.id,
        metadata: {
          changedFields: ["archivedAt"],
          changes: {
            archivedAt: {
              from: null,
              to: archivedAt.toISOString(),
            },
          },
        },
      }),
    );

    return { patient: archivedPatient, alreadyArchived: false };
  });

  return {
    patient: toSafePatient(result.patient),
    alreadyArchived: result.alreadyArchived,
  };
};
