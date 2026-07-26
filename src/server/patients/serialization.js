export const toDateOnly = (date) => date.toISOString().slice(0, 10);

export const toSafePatient = (patient) => ({
  id: patient.id,
  mrn: patient.mrn,
  firstName: patient.firstName,
  lastName: patient.lastName,
  dateOfBirth: toDateOnly(patient.dateOfBirth),
  sex: patient.sex,
  email: patient.email,
  phone: patient.phone,
  archivedAt: patient.archivedAt?.toISOString() ?? null,
  createdAt: patient.createdAt.toISOString(),
  updatedAt: patient.updatedAt.toISOString(),
});

export const toSafePatientListItem = (patient) => ({
  id: patient.id,
  mrn: patient.mrn,
  firstName: patient.firstName,
  lastName: patient.lastName,
  dateOfBirth: toDateOnly(patient.dateOfBirth),
  sex: patient.sex,
  email: patient.email,
  phone: patient.phone,
  origin: patient.origin,
  fhirOwnership: patient.fhirOwnership,
  fhirSyncStatus: patient.fhirSyncStatus,
  fhirLastSyncedAt: patient.fhirLastSyncedAt?.toISOString() ?? null,
});

const toSafeAssessment = (assessment) => {
  const scoring = assessment.questionnaire.definition?.scoring;

  return {
    questionnaire: {
      code: assessment.questionnaire.code,
      version: assessment.questionnaire.version,
      title: assessment.questionnaire.title,
    },
    status: assessment.status,
    scheduledFor: assessment.scheduledFor.toISOString(),
    sentAt: assessment.sentAt?.toISOString() ?? null,
    completedAt: assessment.completedAt?.toISOString() ?? null,
    createdAt: assessment.createdAt.toISOString(),
    response: assessment.response
      ? {
          totalScore: assessment.response.totalScore,
          riskBand: assessment.response.riskBand,
          submittedAt: assessment.response.submittedAt.toISOString(),
          scoreMaximum: Number.isInteger(scoring?.max) ? scoring.max : null,
        }
      : null,
  };
};

export const toSafeActivePatientDetail = (patient) => ({
  mrn: patient.mrn,
  firstName: patient.firstName,
  lastName: patient.lastName,
  dateOfBirth: toDateOnly(patient.dateOfBirth),
  sex: patient.sex,
  email: patient.email,
  phone: patient.phone,
  origin: patient.origin,
  fhirOwnership: patient.fhirOwnership,
  fhirSyncStatus: patient.fhirSyncStatus,
  fhirLastSyncedAt: patient.fhirLastSyncedAt?.toISOString() ?? null,
  createdAt: patient.createdAt.toISOString(),
  updatedAt: patient.updatedAt.toISOString(),
  assessments: patient.assessments.map(toSafeAssessment),
});

export const PATIENT_SAFE_SELECT = Object.freeze({
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  email: true,
  phone: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const PATIENT_LIST_SELECT = Object.freeze({
  id: true,
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  email: true,
  phone: true,
  origin: true,
  fhirOwnership: true,
  fhirSyncStatus: true,
  fhirLastSyncedAt: true,
});

export const PATIENT_DETAIL_SELECT = Object.freeze({
  mrn: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  email: true,
  phone: true,
  origin: true,
  fhirOwnership: true,
  fhirSyncStatus: true,
  fhirLastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  assessments: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      status: true,
      scheduledFor: true,
      sentAt: true,
      completedAt: true,
      createdAt: true,
      questionnaire: {
        select: {
          code: true,
          version: true,
          title: true,
          definition: true,
        },
      },
      response: {
        select: {
          totalScore: true,
          riskBand: true,
          submittedAt: true,
        },
      },
    },
  },
});
