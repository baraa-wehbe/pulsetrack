import {
  PATIENT_LIST_SELECT,
  PATIENT_SAFE_SELECT,
  toDateOnly,
  toSafePatient,
  toSafePatientListItem,
} from "@/server/patients/serialization";

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

export const listActivePatients = async (prismaClient) => {
  const patients = await prismaClient.patient.findMany({
    where: { archivedAt: null },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
      { mrn: "asc" },
      { id: "asc" },
    ],
    select: PATIENT_LIST_SELECT,
  });

  return patients.map(toSafePatientListItem);
};

export const getPatientById = async (prismaClient, patientId) => {
  const patient = await prismaClient.patient.findUnique({
    where: { id: patientId },
    select: PATIENT_SAFE_SELECT,
  });

  return patient ? toSafePatient(patient) : null;
};

export const createPatient = async (
  prismaClient,
  actorId,
  input,
  { auditWriter = defaultAuditWriter } = {},
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
  { auditWriter = defaultAuditWriter } = {},
) => {
  try {
    const result = await prismaClient.$transaction(async (transaction) => {
      const existingPatient = await transaction.patient.findUnique({
        where: { id: patientId },
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
      const updatedPatient = await transaction.patient.update({
        where: { id: patientId },
        data,
        select: PATIENT_SAFE_SELECT,
      });

      await auditWriter(
        transaction,
        auditData({
          action: PATIENT_AUDIT_ACTIONS.update,
          actorId,
          patientId,
          metadata: { changedFields, changes },
        }),
      );

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
    const existingPatient = await transaction.patient.findUnique({
      where: { id: patientId },
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
      where: { id: patientId },
      data: { archivedAt },
      select: PATIENT_SAFE_SELECT,
    });

    await auditWriter(
      transaction,
      auditData({
        action: PATIENT_AUDIT_ACTIONS.archive,
        actorId,
        patientId,
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
