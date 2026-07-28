import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { sendAssessmentEmail } from "@/server/assessments/email";
import {
  ASSESSMENT_EXPIRY_MS,
  ASSESSMENT_MAX_SEND_ATTEMPTS,
  ASSESSMENT_RETRY_DELAY_MS,
  ASSESSMENT_RETRY_WINDOW_MS,
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

test("SendGrid adapter uses server-only credentials and the v3 mail shape", async (t) => {
  const originalApiKey = process.env.SENDGRID_API_KEY;
  const originalFrom = process.env.ASSESSMENT_EMAIL_FROM;
  const originalFetch = globalThis.fetch;
  process.env.SENDGRID_API_KEY = "SG.test-key";
  process.env.ASSESSMENT_EMAIL_FROM =
    "PulseTrack <verified-sender@example.test>";

  t.after(() => {
    if (originalApiKey === undefined) delete process.env.SENDGRID_API_KEY;
    else process.env.SENDGRID_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.ASSESSMENT_EMAIL_FROM;
    else process.env.ASSESSMENT_EMAIL_FROM = originalFrom;
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, request) => {
    assert.equal(url, "https://api.sendgrid.com/v3/mail/send");
    assert.equal(request.method, "POST");
    assert.equal(request.headers.Authorization, "Bearer SG.test-key");
    assert.equal(request.headers["Content-Type"], "application/json");
    assert.equal(request.headers["Idempotency-Key"], "delivery-key");
    const body = JSON.parse(request.body);
    assert.deepEqual(body.from, {
      email: "verified-sender@example.test",
      name: "PulseTrack",
    });
    assert.deepEqual(body.personalizations, [
      {
        to: [
          {
            email: "patient@example.test",
            name: "Maya Haddad",
          },
        ],
      },
    ]);
    assert.equal(body.content[0].type, "text/plain");
    assert.match(body.content[0].value, /^Hello Maya,/);
    assert.match(body.content[0].value, /Name: Maya Haddad/);
    assert.match(body.content[0].value, /MRN: MRN-TEST-001/);
    assert.match(body.content[0].value, /Assessment: DSMA-8/);
    assert.match(
      body.content[0].value,
      /https:\/\/app\.example\.test\/assessment\/token/,
    );
    assert.match(body.content[0].value, /do not forward this email/);
    return new Response(null, {
      status: 202,
      headers: { "x-message-id": "sendgrid-message-id" },
    });
  };

  const result = await sendAssessmentEmail({
    assessmentUrl: "https://app.example.test/assessment/token",
    idempotencyKey: "delivery-key",
    patientFirstName: "Maya",
    patientMrn: "MRN-TEST-001",
    patientName: "Maya Haddad",
    questionnaireTitle: "DSMA-8",
    recipientEmail: "patient@example.test",
  });

  assert.deepEqual(result, {
    provider: "sendgrid",
    messageId: "sendgrid-message-id",
  });
});

test("due scheduler invokes the shared delivery function for each due assessment", async () => {
  const now = new Date("2026-07-26T12:00:00.000Z");
  const calls = [];
  const prisma = {
    assessment: {
      findMany: async (query) => {
        assert.deepEqual(query.where, {
          scheduledFor: { lte: now },
          OR: [
            { status: "SCHEDULED" },
            {
              status: "FAILED",
              sendAttempts: { lt: ASSESSMENT_MAX_SEND_ATTEMPTS },
              scheduledFor: {
                gte: new Date(now.getTime() - ASSESSMENT_RETRY_WINDOW_MS),
              },
              updatedAt: {
                lte: new Date(now.getTime() - ASSESSMENT_RETRY_DELAY_MS),
              },
            },
          ],
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
          "../../components/patient-assessment-modal.js",
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
  assert.doesNotMatch(
    form,
    /rawToken|tokenHash|SENDGRID|ASSESSMENT_EMAIL_FROM/,
  );
  assert.doesNotMatch(service, /console\.(?:log|error)[\s\S]*rawToken/);
  assert.match(form, /<label/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /role="alert"/);
  assert.match(form, /type="datetime-local"/);
  assert.match(workflow, /Dialog\.Title/);
  assert.match(workflow, /Dialog\.Description/);
  assert.match(workflow, /Dialog\.Close/);
  assert.match(workflow, /PatientAssessmentForm/);
  assert.match(workflow, /router\.refresh\(\)/);
  assert.match(workflow, /singleUseAssessmentLink/);
  assert.match(form, /scheduleTimezone/);
  assert.match(form, /disabled=\{pending \|\| !hasEmail\}/);
  assert.doesNotMatch(form, /router\.(?:push|replace)|window\.location/);
  assert.match(sendPage, /redirect\(`/);
  assert.match(schedulePage, /redirect\(`/);
  assert.match(email, /process\.env\.SENDGRID_API_KEY/);
  assert.doesNotMatch(email, /NEXT_PUBLIC_SENDGRID/);
});
