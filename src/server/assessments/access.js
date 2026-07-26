import { createHmac, timingSafeEqual } from "node:crypto";

import { ASSESSMENT_ACCESS_DURATION_SECONDS } from "@/config/assessment-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
const SIGNING_CONTEXT = "pulsetrack:assessment-access:v1:";

const sign = (payload, secret) =>
  createHmac("sha256", secret)
    .update(`${SIGNING_CONTEXT}${payload}`)
    .digest("base64url");

export const createAssessmentAccessCredential = (
  assessmentId,
  secret,
  now = new Date(),
) => {
  if (!UUID_PATTERN.test(assessmentId) || secret.length < 32) {
    throw new Error("Invalid assessment access configuration.");
  }

  const payload = Buffer.from(
    JSON.stringify({
      aid: assessmentId.toLowerCase(),
      exp:
        Math.floor(now.getTime() / 1000) + ASSESSMENT_ACCESS_DURATION_SECONDS,
    }),
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
};

export const verifyAssessmentAccessCredential = (
  credential,
  secret,
  now = new Date(),
) => {
  if (
    typeof credential !== "string" ||
    !CREDENTIAL_PATTERN.test(credential) ||
    secret.length < 32
  ) {
    return null;
  }

  const [payload, signature] = credential.split(".");
  const expected = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    !claims ||
    Object.keys(claims).sort().join(",") !== "aid,exp" ||
    !UUID_PATTERN.test(claims.aid) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= Math.floor(now.getTime() / 1000)
  ) {
    return null;
  }

  return { assessmentId: claims.aid, expiresAt: claims.exp };
};
