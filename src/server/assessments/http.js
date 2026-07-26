import { z } from "zod";

import { AssessmentServiceError } from "@/server/assessments/service";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export const assessmentJson = (body, init = {}) =>
  Response.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...init.headers },
  });

export const assessmentValidationResponse = (error) => {
  const flattened = z.flattenError(error);
  const fieldErrors = Object.fromEntries(
    Object.entries(flattened.fieldErrors).map(([field, messages]) => [
      field,
      messages[0],
    ]),
  );

  return assessmentJson(
    {
      error: "Invalid assessment input.",
      code: "VALIDATION_ERROR",
      fieldErrors,
    },
    { status: 400 },
  );
};

export const assessmentServiceErrorResponse = (error) => {
  if (!(error instanceof AssessmentServiceError)) return null;

  if (
    error.code === "PATIENT_NOT_FOUND" ||
    error.code === "ASSESSMENT_NOT_FOUND"
  ) {
    return assessmentJson(
      { error: "Patient not found.", code: "PATIENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (error.code === "PATIENT_EMAIL_REQUIRED") {
    return assessmentJson(
      {
        error: "A patient email address is required.",
        code: "PATIENT_EMAIL_REQUIRED",
      },
      { status: 409 },
    );
  }

  if (error.code === "QUESTIONNAIRE_UNAVAILABLE") {
    return assessmentJson(
      {
        error: "The assessment questionnaire is unavailable.",
        code: "QUESTIONNAIRE_UNAVAILABLE",
      },
      { status: 409 },
    );
  }

  if (error.code === "INVALID_SCHEDULE") {
    return assessmentJson(
      {
        error: "Invalid assessment input.",
        code: "VALIDATION_ERROR",
        fieldErrors: { scheduledFor: "past_schedule" },
      },
      { status: 400 },
    );
  }

  return null;
};
