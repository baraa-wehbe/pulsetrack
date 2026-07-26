import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createAssessmentAccessCredential,
  verifyAssessmentAccessCredential,
} from "@/server/assessments/access";
import { isValidAssessmentToken } from "@/server/assessments/token";

const secret = "test-secret-that-is-at-least-thirty-two-characters";
const assessmentId = "8700ba23-32c7-4d26-9497-35fcf7660f51";
const now = new Date("2026-07-26T12:00:00.000Z");

test("assessment access credentials are signed, finite, and tamper-resistant", () => {
  const credential = createAssessmentAccessCredential(
    assessmentId,
    secret,
    now,
  );
  assert.deepEqual(verifyAssessmentAccessCredential(credential, secret, now), {
    assessmentId,
    expiresAt: Math.floor(now.getTime() / 1000) + 3600,
  });
  assert.equal(
    verifyAssessmentAccessCredential(
      `${credential.slice(0, -1)}x`,
      secret,
      now,
    ),
    null,
  );
  assert.equal(
    verifyAssessmentAccessCredential(
      credential,
      secret,
      new Date(now.getTime() + 3_600_001),
    ),
    null,
  );
});

test("raw token format is bounded before hashing", () => {
  assert.equal(isValidAssessmentToken("a".repeat(43)), true);
  assert.equal(isValidAssessmentToken("a".repeat(42)), false);
  assert.equal(isValidAssessmentToken("a".repeat(44)), false);
  assert.equal(isValidAssessmentToken(`${"a".repeat(42)}!`), false);
});

test("public form is outside the private shell and never receives token material", async () => {
  const [page, form, exchangeRoute, submitRoute] = await Promise.all([
    readFile(
      new URL("../../app/(public)/assessment/page.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../../components/public-assessment-form.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../app/(public)/assessment/[token]/route.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../../app/(public)/assessment/submit/route.js", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(page, /AuthenticatedShell|requireCurrentClinician/);
  assert.match(page, /loadPublicAssessment/);
  assert.match(form, /questionnaire\.items\.map/);
  assert.match(form, /questionnaire\.options\.map/);
  assert.match(form, /<fieldset/);
  assert.match(form, /<legend/);
  assert.doesNotMatch(form, /token|tokenHash|assessmentId/);
  assert.match(exchangeRoute, /exchangeAssessmentToken/);
  assert.doesNotMatch(submitRoute, /tokenHash|rawToken/);
});
