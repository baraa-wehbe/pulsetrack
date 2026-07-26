import { z } from "zod";

const questionnaireOptionSchema = z
  .object({
    value: z.number().int(),
    label: z.string().trim().min(1).max(200),
  })
  .strict();

const questionnaireItemSchema = z
  .object({
    id: z.string().trim().min(1).max(50),
    text: z.string().trim().min(1).max(1000),
  })
  .strict();

const scoringBandSchema = z
  .object({
    min: z.number().int(),
    max: z.number().int(),
    label: z.string().trim().min(1).max(100),
    color: z.string().trim().min(1).max(30),
    guidance: z.string().trim().min(1).max(500),
  })
  .strict();

export const questionnaireDefinitionSchema = z
  .object({
    id: z.string().trim().min(1).max(50),
    version: z.string().trim().min(1).max(30),
    title: z.string().trim().min(1).max(200),
    instructions: z.string().trim().min(1).max(2000),
    options: z.array(questionnaireOptionSchema).min(1).max(20),
    items: z.array(questionnaireItemSchema).length(8),
    scoring: z
      .object({
        method: z.literal("sum"),
        min: z.number().int(),
        max: z.number().int(),
        allItemsRequired: z.literal(true),
        bands: z.array(scoringBandSchema).min(1).max(20),
      })
      .strict(),
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((definition, context) => {
    const itemIds = definition.items.map(({ id }) => id);
    const optionValues = definition.options.map(({ value }) => value);

    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "duplicate_items",
      });
    }
    if (new Set(optionValues).size !== optionValues.length) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "duplicate_options",
      });
    }
  });

const submittedAnswerSchema = z
  .object({
    questionId: z.string().min(1).max(50),
    value: z.number().int(),
  })
  .strict();

export const assessmentSubmissionSchema = z
  .object({
    answers: z.array(submittedAnswerSchema).length(8),
  })
  .strict();

export class QuestionnaireValidationError extends Error {
  constructor(
    code = "INVALID_ANSWERS",
    message = "Invalid questionnaire response.",
  ) {
    super(message);
    this.name = "QuestionnaireValidationError";
    this.code = code;
  }
}

const RISK_LABELS = Object.freeze({
  "low risk": "LOW",
  "moderate risk": "MODERATE",
  "high risk": "HIGH",
  "very high risk": "VERY_HIGH",
});

export const parseStoredQuestionnaire = (value) => {
  const parsed = questionnaireDefinitionSchema.safeParse(value);
  if (!parsed.success) {
    throw new QuestionnaireValidationError(
      "INVALID_DEFINITION",
      "Stored questionnaire definition is invalid.",
    );
  }
  return parsed.data;
};

export const validateAssessmentAnswers = (definition, input) => {
  const parsedInput = assessmentSubmissionSchema.safeParse(input);
  if (!parsedInput.success) {
    throw new QuestionnaireValidationError();
  }

  const expectedIds = new Set(definition.items.map(({ id }) => id));
  const allowedValues = new Set(definition.options.map(({ value }) => value));
  const submittedIds = parsedInput.data.answers.map(
    ({ questionId }) => questionId,
  );

  if (
    new Set(submittedIds).size !== submittedIds.length ||
    submittedIds.some((id) => !expectedIds.has(id)) ||
    parsedInput.data.answers.some(({ value }) => !allowedValues.has(value))
  ) {
    throw new QuestionnaireValidationError();
  }

  const answers = Object.fromEntries(
    parsedInput.data.answers.map(({ questionId, value }) => [
      questionId,
      value,
    ]),
  );
  if (
    Object.keys(answers).length !== expectedIds.size ||
    [...expectedIds].some((id) => !(id in answers))
  ) {
    throw new QuestionnaireValidationError();
  }

  return answers;
};

export const scoreAssessmentAnswers = (definition, answers) => {
  const totalScore = definition.items.reduce(
    (total, { id }) => total + answers[id],
    0,
  );
  const band = definition.scoring.bands.find(
    ({ min, max }) => totalScore >= min && totalScore <= max,
  );
  const riskBand = RISK_LABELS[band?.label.toLowerCase()];

  if (
    !band ||
    !riskBand ||
    totalScore < definition.scoring.min ||
    totalScore > definition.scoring.max
  ) {
    throw new QuestionnaireValidationError(
      "INVALID_DEFINITION",
      "Stored questionnaire scoring is invalid.",
    );
  }

  return { totalScore, riskBand, band };
};

export const toPublicQuestionnaire = (definition) => ({
  title: definition.title,
  instructions: definition.instructions,
  items: definition.items.map(({ id, text }) => ({ id, text })),
  options: definition.options.map(({ value, label }) => ({ value, label })),
});
