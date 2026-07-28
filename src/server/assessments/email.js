const PROVIDER_NAME = "sendgrid";
const SAFE_PROVIDER_ID = /^[A-Za-z0-9._:-]{1,255}$/;
const SIMPLE_EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export class AssessmentEmailError extends Error {
  constructor(code, safeMessage) {
    super(safeMessage);
    this.name = "AssessmentEmailError";
    this.code = code;
  }
}

const getEmailConfiguration = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.ASSESSMENT_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new AssessmentEmailError(
      "EMAIL_NOT_CONFIGURED",
      "Email delivery is not configured.",
    );
  }

  const namedSender = from.match(/^([^<>\r\n]{1,100})\s*<([^<>\r\n]+)>$/);
  const senderEmail = (namedSender?.[2] ?? from).trim();
  const senderName = namedSender?.[1].trim();

  if (!SIMPLE_EMAIL.test(senderEmail)) {
    throw new AssessmentEmailError(
      "EMAIL_CONFIGURATION_INVALID",
      "Email delivery is not configured.",
    );
  }

  return {
    apiKey,
    from: senderName
      ? { email: senderEmail, name: senderName }
      : { email: senderEmail },
  };
};

const safeProviderMessageId = (value) =>
  typeof value === "string" && SAFE_PROVIDER_ID.test(value) ? value : null;

export const sendAssessmentEmail = async ({
  assessmentUrl,
  idempotencyKey,
  patientFirstName,
  patientMrn,
  patientName,
  questionnaireTitle,
  recipientEmail,
  signal,
}) => {
  const { apiKey, from } = getEmailConfiguration();
  let response;

  try {
    response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        personalizations: [
          { to: [{ email: recipientEmail, name: patientName }] },
        ],
        from,
        subject: `PulseTrack: ${questionnaireTitle}`,
        content: [
          {
            type: "text/plain",
            value: [
              `Hello ${patientFirstName},`,
              "",
              "A secure PulseTrack assessment is ready for you.",
              "",
              "Patient details",
              `Name: ${patientName}`,
              `MRN: ${patientMrn}`,
              `Assessment: ${questionnaireTitle}`,
              "",
              `Complete your assessment using this secure link: ${assessmentUrl}`,
              "",
              "This link expires seven days after delivery.",
              "For your privacy, do not forward this email or share the link.",
              "If the patient details above do not match you, do not open the link and contact your care team.",
            ].join("\n"),
          },
        ],
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

  const messageId =
    safeProviderMessageId(response.headers.get("x-message-id")) ??
    `accepted:${idempotencyKey}`;

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
