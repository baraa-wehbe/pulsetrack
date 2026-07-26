import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ASSESSMENT_EXPIRY_MS,
  expireSentAssessments,
  processDueAssessments,
} from "@/server/assessments/service";
import {
  createAssessmentToken,
  hashAssessmentToken,
} from "@/server/assessments/token";

test("assessment tokens are random URL-safe values stored through SHA-256 hashes", () => {
  const first = createAssessmentToken();
  const second = createAssessmentToken();

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashAssessmentToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashAssessmentToken(first), first);
});

test("expiry duration is exactly seven 24-hour days", () => {
  assert.equal(ASSESSMENT_EXPIRY_MS, 604_800_000);
});

test("due scheduler invokes the shared delivery function for each due assessment", async () => {
  const now = new Date("2026-07-26T12:00:00.000Z");
  const calls = [];
  const prisma = {
    assessment: {
      findMany: async (query) => {
        assert.deepEqual(query.where, {
          status: "SCHEDULED",
          scheduledFor: { lte: now },
        });
        return [{ id: "assessment-1" }, { id: "assessment-2" }];
      },
    },
  };
  const result = await processDueAssessments(prisma, {
    now,
    deliver: async (client, id, options) => {
      calls.push({ client, id, options });
      return { delivered: id === "assessment-1" };
    },
  });

  assert.deepEqual(
    calls.map(({ id }) => id),
    ["assessment-1", "assessment-2"],
  );
  assert.ok(calls.every(({ client }) => client === prisma));
  assert.deepEqual(result, {
    processed: 2,
    delivered: 1,
    failed: 1,
    skipped: 0,
    cancelled: 0,
  });
});

test("expiry processing changes only sent assessments whose expiry has passed", async () => {
  const now = new Date("2026-08-02T12:00:00.000Z");
  let query;
  const count = await expireSentAssessments(
    {
      assessment: {
        updateMany: async (value) => {
          query = value;
          return { count: 3 };
        },
      },
    },
    now,
  );

  assert.equal(count, 3);
  assert.deepEqual(query, {
    where: {
      status: "SENT",
      tokenConsumedAt: null,
      completedAt: null,
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
});

test("raw tokens stay out of response serializers, logs, and client modules", async () => {
  const [service, route, form, workflow, sendPage, schedulePage, email] =
    await Promise.all([
      readFile(new URL("./service.js", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../../app/api/private/patients/[patientId]/assessments/route.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../../components/patient-assessment-form.js", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../../components/patient-assessment-workflow.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../app/(private)/patients/[patientId]/send/page.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../app/(private)/patients/[patientId]/schedule/page.js",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("./email.js", import.meta.url), "utf8"),
    ]);

  assert.match(route, /withClinicianAuthentication/);
  assert.match(route, /createAssessmentRequestSchemaForDate/);
  assert.doesNotMatch(route, /rawToken|tokenHash|assessmentUrl/);
  assert.doesNotMatch(form, /rawToken|tokenHash|RESEND|ASSESSMENT_EMAIL_FROM/);
  assert.doesNotMatch(service, /console\.(?:log|error)[\s\S]*rawToken/);
  assert.match(form, /<label/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /role="alert"/);
  assert.match(form, /type="datetime-local"/);
  assert.match(workflow, /PatientAssessmentForm/);
  assert.match(sendPage, /getActivePatientForAssessment/);
  assert.match(schedulePage, /getActivePatientForAssessment/);
  assert.match(email, /process\.env\.RESEND_API_KEY/);
  assert.doesNotMatch(email, /NEXT_PUBLIC_RESEND/);
});
