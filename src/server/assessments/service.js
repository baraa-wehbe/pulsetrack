import {
  createAssessmentToken,
  hashAssessmentToken,
} from "@/server/assessments/token";
import {
  sanitizeAssessmentEmailError,
  sendAssessmentEmail,
} from "@/server/assessments/email";

export const ASSESSMENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const ACTIVE_QUESTIONNAIRE_CODE = "dsma-8";

export class AssessmentServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AssessmentServiceError";
    this.code = code;
  }
}

const ASSESSMENT_PUBLIC_SELECT = Object.freeze({
  status: true,
  scheduledFor: true,
  sentAt: true,
  expiresAt: true,
  sendAttempts: true,
  createdAt: true,
});

const toSafeAssessment = (assessment) => ({
  status: assessment.status,
  scheduledFor: assessment.scheduledFor.toISOString(),
  sentAt: assessment.sentAt?.toISOString() ?? null,
  expiresAt: assessment.expiresAt?.toISOString() ?? null,
  sendAttempts: assessment.sendAttempts,
  createdAt: assessment.createdAt.toISOString(),
});

const createAudit = (transaction, data) =>
  transaction.auditLog.create({ data, select: { id: true } });

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const patientIdentifierWhere = (patientIdentifier) =>
  UUID_PATTERN.test(patientIdentifier)
    ? { OR: [{ id: patientIdentifier }, { mrn: patientIdentifier }] }
    : { mrn: patientIdentifier.trim().toUpperCase() };

const getActivePatient = (transaction, patientIdentifier) =>
  transaction.patient.findFirst({
    where: {
      ...patientIdentifierWhere(patientIdentifier),
      archivedAt: null,
    },
    select: {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

export const getActivePatientForAssessment = async (
  prismaClient,
  patientIdentifier,
) => {
  const patient = await getActivePatient(prismaClient, patientIdentifier);

  return patient
    ? {
        mrn: patient.mrn,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
      }
    : null;
};

const getActiveQuestionnaire = (transaction) =>
  transaction.questionnaire.findFirst({
    where: { code: ACTIVE_QUESTIONNAIRE_CODE, isActive: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, title: true },
  });

const createAssessmentRecord = async (
  prismaClient,
  actorId,
  patientIdentifier,
  input,
  now,
) => {
  if (
    input.deliveryMode === "SCHEDULED" &&
    (!(input.scheduledFor instanceof Date) ||
      !Number.isFinite(input.scheduledFor.getTime()) ||
      input.scheduledFor <= now)
  ) {
    throw new AssessmentServiceError(
      "INVALID_SCHEDULE",
      "Scheduled delivery must be in the future.",
    );
  }

  return prismaClient.$transaction(async (transaction) => {
    const [patient, questionnaire] = await Promise.all([
      getActivePatient(transaction, patientIdentifier),
      getActiveQuestionnaire(transaction),
    ]);

    if (!patient) {
      throw new AssessmentServiceError(
        "PATIENT_NOT_FOUND",
        "Active patient not found.",
      );
    }
    if (!patient.email) {
      throw new AssessmentServiceError(
        "PATIENT_EMAIL_REQUIRED",
        "A patient email address is required.",
      );
    }
    if (!questionnaire) {
      throw new AssessmentServiceError(
        "QUESTIONNAIRE_UNAVAILABLE",
        "The active questionnaire is unavailable.",
      );
    }

    const scheduledFor = input.scheduledFor ?? now;
    const assessment = await transaction.assessment.create({
      data: {
        patientId: patient.id,
        questionnaireId: questionnaire.id,
        createdById: actorId,
        recipientEmail: patient.email,
        scheduledFor,
        status: "SCHEDULED",
      },
      select: {
        id: true,
        ...ASSESSMENT_PUBLIC_SELECT,
      },
    });

    await createAudit(transaction, {
      actorType: "CLINICIAN",
      clinicianId: actorId,
      action:
        input.deliveryMode === "IMMEDIATE"
          ? "ASSESSMENT_CREATED"
          : "ASSESSMENT_SCHEDULED",
      entityType: "ASSESSMENT",
      entityId: assessment.id,
      metadata: {
        deliveryMode: input.deliveryMode,
        scheduledFor: scheduledFor.toISOString(),
        patientId: patient.id,
        questionnaireCode: ACTIVE_QUESTIONNAIRE_CODE,
      },
    });

    return { assessment, patient, questionnaire };
  });
};

const deliveryLookupSelect = Object.freeze({
  id: true,
  status: true,
  scheduledFor: true,
  recipientEmail: true,
  sendAttempts: true,
  patient: {
    select: {
      archivedAt: true,
      firstName: true,
      lastName: true,
    },
  },
  questionnaire: { select: { title: true } },
});

export const deliverAssessment = async (
  prismaClient,
  assessmentId,
  {
    emailSender = sendAssessmentEmail,
    now = new Date(),
    clock = () => new Date(),
    appUrl = process.env.NEXT_PUBLIC_APP_URL,
    tokenFactory = createAssessmentToken,
  } = {},
) => {
  const assessment = await prismaClient.assessment.findUnique({
    where: { id: assessmentId },
    select: deliveryLookupSelect,
  });

  if (!assessment) {
    throw new AssessmentServiceError(
      "ASSESSMENT_NOT_FOUND",
      "Assessment not found.",
    );
  }
  if (assessment.patient.archivedAt) {
    await prismaClient.assessment.updateMany({
      where: { id: assessment.id, status: "SCHEDULED" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    throw new AssessmentServiceError(
      "PATIENT_NOT_FOUND",
      "Active patient not found.",
    );
  }
  if (assessment.status !== "SCHEDULED" && assessment.status !== "FAILED") {
    throw new AssessmentServiceError(
      "NOT_DELIVERABLE",
      "Assessment cannot be delivered in its current state.",
    );
  }
  if (assessment.scheduledFor > now) {
    throw new AssessmentServiceError(
      "NOT_DUE",
      "Assessment is not due for delivery.",
    );
  }
  if (!appUrl) {
    throw new AssessmentServiceError(
      "APP_URL_UNAVAILABLE",
      "Assessment delivery configuration is unavailable.",
    );
  }

  const rawToken = tokenFactory();
  const tokenHash = hashAssessmentToken(rawToken);
  const assessmentUrl = new URL(
    `/assessment/${encodeURIComponent(rawToken)}`,
    appUrl,
  ).toString();
  const attemptNumber = assessment.sendAttempts + 1;

  let providerResult;
  try {
    providerResult = await emailSender({
      assessmentUrl,
      patientName:
        `${assessment.patient.firstName} ${assessment.patient.lastName}`.trim(),
      questionnaireTitle: assessment.questionnaire.title,
      recipientEmail: assessment.recipientEmail,
    });
  } catch (error) {
    const safeError = sanitizeAssessmentEmailError(error);
    const updated = await prismaClient.$transaction(async (transaction) => {
      const result = await transaction.assessment.update({
        where: { id: assessment.id },
        data: {
          status: "FAILED",
          tokenHash,
          sentAt: null,
          expiresAt: null,
          sendAttempts: { increment: 1 },
          lastSendError: safeError.message,
          emailProviderMessageId: null,
        },
        select: ASSESSMENT_PUBLIC_SELECT,
      });
      await transaction.assessmentDeliveryAttempt.create({
        data: {
          assessmentId: assessment.id,
          attemptNumber,
          status: "FAILED",
          provider: safeError.provider,
          errorCode: safeError.code,
          errorMessage: safeError.message,
        },
        select: { id: true },
      });
      return result;
    });

    return { assessment: toSafeAssessment(updated), delivered: false };
  }

  const sentAt = clock();
  const expiresAt = new Date(sentAt.getTime() + ASSESSMENT_EXPIRY_MS);
  const updated = await prismaClient.$transaction(async (transaction) => {
    const result = await transaction.assessment.update({
      where: { id: assessment.id },
      data: {
        status: "SENT",
        tokenHash,
        sentAt,
        expiresAt,
        sendAttempts: { increment: 1 },
        lastSendError: null,
        emailProviderMessageId: providerResult.messageId,
      },
      select: ASSESSMENT_PUBLIC_SELECT,
    });
    await transaction.assessmentDeliveryAttempt.create({
      data: {
        assessmentId: assessment.id,
        attemptNumber,
        status: "SUCCEEDED",
        provider: providerResult.provider,
        providerMessageId: providerResult.messageId,
      },
      select: { id: true },
    });
    return result;
  });

  return { assessment: toSafeAssessment(updated), delivered: true };
};

export const createAssessment = async (
  prismaClient,
  actorId,
  patientIdentifier,
  input,
  options = {},
) => {
  const now = options.now ?? new Date();
  const created = await createAssessmentRecord(
    prismaClient,
    actorId,
    patientIdentifier,
    input,
    now,
  );

  if (input.deliveryMode === "SCHEDULED") {
    return {
      assessment: toSafeAssessment(created.assessment),
      delivered: false,
      scheduled: true,
    };
  }

  return deliverAssessment(prismaClient, created.assessment.id, {
    ...options,
    now,
  });
};

export const processDueAssessments = async (
  prismaClient,
  {
    now = new Date(),
    limit = 50,
    deliver = deliverAssessment,
    ...deliveryOptions
  } = {},
) => {
  const due = await prismaClient.assessment.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true },
  });
  const results = [];
  let skipped = 0;

  for (const { id } of due) {
    try {
      results.push(
        await deliver(prismaClient, id, { ...deliveryOptions, now }),
      );
    } catch (error) {
      if (error instanceof AssessmentServiceError) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return {
    processed: results.length,
    delivered: results.filter((result) => result.delivered).length,
    failed: results.filter((result) => !result.delivered).length,
    skipped,
  };
};

export const expireSentAssessments = async (prismaClient, now = new Date()) => {
  const result = await prismaClient.assessment.updateMany({
    where: {
      status: "SENT",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  return result.count;
};
