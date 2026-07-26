import { createHash, randomBytes } from "node:crypto";

const ASSESSMENT_TOKEN_BYTES = 32;

export const createAssessmentToken = () =>
  randomBytes(ASSESSMENT_TOKEN_BYTES).toString("base64url");

export const hashAssessmentToken = (token) =>
  createHash("sha256").update(token).digest("hex");
