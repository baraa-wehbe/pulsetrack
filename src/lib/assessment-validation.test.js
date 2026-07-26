import assert from "node:assert/strict";
import test from "node:test";

import { createAssessmentRequestSchemaForDate } from "@/lib/assessment-validation";

const now = new Date("2026-07-26T12:00:00.000Z");
const schema = createAssessmentRequestSchemaForDate(now);

test("immediate assessment input accepts no schedule and rejects extra fields", () => {
  assert.deepEqual(
    schema.parse({ deliveryMode: "IMMEDIATE", scheduledFor: null }),
    { deliveryMode: "IMMEDIATE", scheduledFor: null },
  );
  assert.equal(
    schema.safeParse({
      deliveryMode: "IMMEDIATE",
      scheduledFor: null,
      token: "client-controlled",
    }).success,
    false,
  );
});

test("scheduled assessment requires a valid future timestamp", () => {
  const parsed = schema.parse({
    deliveryMode: "SCHEDULED",
    scheduledFor: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(parsed.scheduledFor.toISOString(), "2026-07-27T12:00:00.000Z");

  for (const scheduledFor of [
    null,
    "not-a-date",
    "2026-07-26T11:59:59.999Z",
    "2026-07-26T12:00:00.000Z",
  ]) {
    assert.equal(
      schema.safeParse({
        deliveryMode: "SCHEDULED",
        scheduledFor,
      }).success,
      false,
    );
  }
});

test("immediate requests cannot smuggle a scheduled timestamp", () => {
  assert.equal(
    schema.safeParse({
      deliveryMode: "IMMEDIATE",
      scheduledFor: "2026-07-27T12:00:00.000Z",
    }).success,
    false,
  );
});
