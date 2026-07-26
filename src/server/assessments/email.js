const PROVIDER_NAME = "resend";
const SAFE_PROVIDER_ID = /^[A-Za-z0-9._:-]{1,255}$/;

export class AssessmentEmailError extends Error {
  constructor(code, safeMessage) {
    super(safeMessage);
    this.name = "AssessmentEmailError";
    this.code = code;
  }
}

const getEmailConfiguration = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ASSESSMENT_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new AssessmentEmailError(
      "EMAIL_NOT_CONFIGURED",
      "Email delivery is not configured.",
    );
  }

  return { apiKey, from };
};

const safeProviderMessageId = (value) =>
  typeof value === "string" && SAFE_PROVIDER_ID.test(value) ? value : null;

export const sendAssessmentEmail = async ({
  assessmentUrl,
  idempotencyKey,
  patientName,
  questionnaireTitle,
  recipientEmail,
  signal,
}) => {
  const { apiKey, from } = getEmailConfiguration();
  let response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [recipientEmail],
        subject: `PulseTrack: ${questionnaireTitle}`,
        text: [
          `Hello ${patientName},`,
          "",
          "Your clinician has invited you to complete a PulseTrack assessment.",
          `Open the secure assessment link: ${assessmentUrl}`,
          "",
          "This link expires seven days after delivery.",
        ].join("\n"),
      }),
      signal: signal ?? AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AssessmentEmailError(
      "EMAIL_NETWORK_ERROR",
      "Email delivery could not be confirmed.",
    );
  }

  if (!response.ok) {
    throw new AssessmentEmailError(
      "EMAIL_PROVIDER_REJECTED",
      "Email delivery could not be confirmed.",
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new AssessmentEmailError(
      "EMAIL_PROVIDER_RESPONSE_INVALID",
      "Email delivery could not be confirmed.",
    );
  }

  const messageId = safeProviderMessageId(result?.id);
  if (!messageId) {
    throw new AssessmentEmailError(
      "EMAIL_PROVIDER_RESPONSE_INVALID",
      "Email delivery could not be confirmed.",
    );
  }

  return { provider: PROVIDER_NAME, messageId };
};

export const sanitizeAssessmentEmailError = (error) => {
  if (error instanceof AssessmentEmailError) {
    return {
      code: error.code,
      message: error.message,
      provider: PROVIDER_NAME,
    };
  }

  return {
    code: "EMAIL_DELIVERY_FAILED",
    message: "Email delivery could not be confirmed.",
    provider: PROVIDER_NAME,
  };
};
