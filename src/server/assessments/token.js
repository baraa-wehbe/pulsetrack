import { createHash, randomBytes } from "node:crypto";

const ASSESSMENT_TOKEN_BYTES = 32;
const ASSESSMENT_TOKEN_LENGTH = 43;

export const createAssessmentToken = () =>
  randomBytes(ASSESSMENT_TOKEN_BYTES).toString("base64url");

export const hashAssessmentToken = (token) =>
  createHash("sha256").update(token).digest("hex");

export const isValidAssessmentToken = (token) =>
  typeof token === "string" &&
  token.length === ASSESSMENT_TOKEN_LENGTH &&
  /^[A-Za-z0-9_-]+$/.test(token);
