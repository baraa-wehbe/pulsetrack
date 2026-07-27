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

const PATIENT_LIST_ASSESSMENT_STATUSES = new Set([
  "SCHEDULED",
  "SENT",
  "COMPLETED",
  "EXPIRED",
]);

const toPatientListAssessmentStatus = (assessments = []) => {
  const latestStatus = assessments[0]?.status;
  return PATIENT_LIST_ASSESSMENT_STATUSES.has(latestStatus)
    ? latestStatus
    : "NOT_SENT";
};

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
  assessmentStatus: toPatientListAssessmentStatus(patient.assessments),
});

const toSafeQuestionResponses = (definition, answers) => {
  if (
    !definition ||
    !Array.isArray(definition.items) ||
    !Array.isArray(definition.options) ||
    !answers ||
    typeof answers !== "object" ||
    Array.isArray(answers)
  ) {
    return [];
  }

  const answerLabels = new Map(
    definition.options
      .filter(
        (option) =>
          Number.isInteger(option?.value) &&
          typeof option?.label === "string" &&
          option.label.trim(),
      )
      .map((option) => [option.value, option.label.trim()]),
  );

  return definition.items.flatMap((item) => {
    if (
      typeof item?.id !== "string" ||
      typeof item?.text !== "string" ||
      !Object.hasOwn(answers, item.id) ||
      !Number.isInteger(answers[item.id])
    ) {
      return [];
    }

    const answer = answerLabels.get(answers[item.id]);
    if (!answer) return [];

    return [
      {
        question: item.text.trim(),
        answer,
      },
    ];
  });
};

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
    expiresAt: assessment.expiresAt?.toISOString() ?? null,
    completedAt: assessment.completedAt?.toISOString() ?? null,
    cancelledAt: assessment.cancelledAt?.toISOString() ?? null,
    createdAt: assessment.createdAt.toISOString(),
    updatedAt: (assessment.updatedAt ?? assessment.createdAt).toISOString(),
    deliveryFailed:
      assessment.status === "FAILED" && Boolean(assessment.lastSendError),
    response: assessment.response
      ? {
          totalScore: assessment.response.totalScore,
          riskBand: assessment.response.riskBand,
          submittedAt: assessment.response.submittedAt.toISOString(),
          scoreMaximum: Number.isInteger(scoring?.max) ? scoring.max : null,
          questionResponses: toSafeQuestionResponses(
            assessment.questionnaire.definition,
            assessment.response.answers,
          ),
        }
      : null,
  };
};

export const toSafeActivePatientDetail = (patient) => ({
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
  assessments: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      status: true,
    },
  },
});

export const PATIENT_DETAIL_SELECT = Object.freeze({
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
  createdAt: true,
  updatedAt: true,
  assessments: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      status: true,
      scheduledFor: true,
      sentAt: true,
      expiresAt: true,
      completedAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      lastSendError: true,
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
          answers: true,
          totalScore: true,
          riskBand: true,
          submittedAt: true,
        },
      },
    },
  },
});
