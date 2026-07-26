import {
  parseStoredQuestionnaire,
  QuestionnaireValidationError,
  scoreAssessmentAnswers,
  toPublicQuestionnaire,
  validateAssessmentAnswers,
} from "@/lib/questionnaire";
import {
  hashAssessmentToken,
  isValidAssessmentToken,
} from "@/server/assessments/token";

export class PublicAssessmentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PublicAssessmentError";
    this.code = code;
  }
}

const validAssessmentWhere = (assessmentId, now) => ({
  id: assessmentId,
  status: "SENT",
  tokenConsumedAt: null,
  completedAt: null,
  expiresAt: { gt: now },
  patient: { archivedAt: null },
});

export const exchangeAssessmentToken = async (
  prismaClient,
  rawToken,
  now = new Date(),
) => {
  if (!isValidAssessmentToken(rawToken)) return null;

  const assessment = await prismaClient.assessment.findFirst({
    where: {
      tokenHash: hashAssessmentToken(rawToken),
      status: "SENT",
      tokenConsumedAt: null,
      completedAt: null,
      expiresAt: { gt: now },
      patient: { archivedAt: null },
    },
    select: { id: true },
  });

  return assessment ? { assessmentId: assessment.id } : null;
};

export const loadPublicAssessment = async (
  prismaClient,
  assessmentId,
  now = new Date(),
) => {
  const assessment = await prismaClient.assessment.findFirst({
    where: validAssessmentWhere(assessmentId, now),
    select: {
      questionnaire: {
        select: { definition: true },
      },
    },
  });
  if (!assessment) return null;

  const definition = parseStoredQuestionnaire(
    assessment.questionnaire.definition,
  );
  return { questionnaire: toPublicQuestionnaire(definition) };
};

export const submitPublicAssessment = async (
  prismaClient,
  assessmentId,
  input,
  now = new Date(),
) =>
  prismaClient.$transaction(async (transaction) => {
    const assessment = await transaction.assessment.findFirst({
      where: validAssessmentWhere(assessmentId, now),
      select: {
        id: true,
        questionnaire: {
          select: {
            code: true,
            version: true,
            definition: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new PublicAssessmentError(
        "ASSESSMENT_UNAVAILABLE",
        "Assessment unavailable.",
      );
    }

    const definition = parseStoredQuestionnaire(
      assessment.questionnaire.definition,
    );
    let answers;
    try {
      answers = validateAssessmentAnswers(definition, input);
    } catch (error) {
      if (
        error instanceof QuestionnaireValidationError &&
        error.code === "INVALID_ANSWERS"
      ) {
        throw new PublicAssessmentError(
          "INVALID_ANSWERS",
          "Every question requires a valid answer.",
        );
      }
      throw error;
    }
    const { totalScore, riskBand } = scoreAssessmentAnswers(
      definition,
      answers,
    );

    const consumed = await transaction.assessment.updateMany({
      where: validAssessmentWhere(assessment.id, now),
      data: {
        status: "COMPLETED",
        completedAt: now,
        tokenConsumedAt: now,
      },
    });
    if (consumed.count !== 1) {
      throw new PublicAssessmentError(
        "ASSESSMENT_UNAVAILABLE",
        "Assessment unavailable.",
      );
    }

    await transaction.assessmentResponse.create({
      data: {
        assessmentId: assessment.id,
        answers,
        totalScore,
        riskBand,
        scoringSnapshot: {
          questionnaire: {
            code: assessment.questionnaire.code,
            version: assessment.questionnaire.version,
          },
          scoring: definition.scoring,
        },
        submittedAt: now,
      },
      select: { id: true },
    });

    await transaction.auditLog.create({
      data: {
        actorType: "PATIENT_LINK",
        action: "ASSESSMENT_COMPLETED",
        entityType: "ASSESSMENT",
        entityId: assessment.id,
        metadata: {
          questionnaireCode: assessment.questionnaire.code,
          questionnaireVersion: assessment.questionnaire.version,
          totalScore,
          riskBand,
        },
      },
      select: { id: true },
    });

    return { completed: true };
  });
