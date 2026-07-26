import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseStoredQuestionnaire,
  QuestionnaireValidationError,
  scoreAssessmentAnswers,
  validateAssessmentAnswers,
} from "@/lib/questionnaire";

const source = JSON.parse(
  readFileSync(
    new URL("../../prisma/seed-data/questionnaire-dsma8.json", import.meta.url),
    "utf8",
  ),
);
const definition = parseStoredQuestionnaire(source);

const inputForTotal = (total) => {
  let remaining = total;
  return {
    answers: definition.items.map(({ id }) => {
      const value = Math.min(3, remaining);
      remaining -= value;
      return { questionId: id, value };
    }),
  };
};

test("stored DSMA-8 definition supplies exactly eight items and four options", () => {
  assert.equal(definition.items.length, 8);
  assert.deepEqual(
    definition.options.map(({ value }) => value),
    [0, 1, 2, 3],
  );
});

test("all eight valid answers are normalized to a question-value object", () => {
  const answers = validateAssessmentAnswers(definition, inputForTotal(12));
  assert.deepEqual(
    Object.keys(answers),
    definition.items.map(({ id }) => id),
  );
  assert.equal(
    Object.values(answers).reduce((sum, value) => sum + value, 0),
    12,
  );
});

test("missing, extra, duplicated, malformed, and unsupported answers are rejected", () => {
  const valid = inputForTotal(8);
  const invalidInputs = [
    { answers: valid.answers.slice(0, 7) },
    { answers: [...valid.answers, { questionId: "q9", value: 0 }] },
    {
      answers: [
        ...valid.answers.slice(0, 7),
        { questionId: valid.answers[0].questionId, value: 0 },
      ],
    },
    {
      answers: valid.answers.map((answer, index) =>
        index === 0 ? { ...answer, value: 99 } : answer,
      ),
    },
    {
      answers: valid.answers.map((answer, index) =>
        index === 0 ? { ...answer, questionId: "unknown" } : answer,
      ),
    },
    { answers: valid.answers, unexpected: true },
    { answers: "not-an-array" },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => validateAssessmentAnswers(definition, input),
      QuestionnaireValidationError,
    );
  }
});

test("risk boundaries are calculated exclusively from stored scoring bands", () => {
  for (const [total, riskBand] of [
    [0, "LOW"],
    [6, "LOW"],
    [7, "MODERATE"],
    [12, "MODERATE"],
    [13, "HIGH"],
    [18, "HIGH"],
    [19, "VERY_HIGH"],
    [24, "VERY_HIGH"],
  ]) {
    const answers = validateAssessmentAnswers(definition, inputForTotal(total));
    assert.deepEqual(
      scoreAssessmentAnswers(definition, answers).riskBand,
      riskBand,
    );
  }
});
