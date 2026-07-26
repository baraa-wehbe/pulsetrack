import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSESSMENT_STATUS_PRESENTATIONS,
  getAssessmentTimelineEntries,
} from "@/lib/assessment-presentation";

const base = {
  scheduledFor: "2026-07-26T10:00:00.000Z",
  sentAt: "2026-07-26T10:01:00.000Z",
  expiresAt: "2026-08-02T10:01:00.000Z",
  completedAt: "2026-07-27T10:00:00.000Z",
  cancelledAt: "2026-07-26T09:00:00.000Z",
  updatedAt: "2026-07-26T10:02:00.000Z",
};

test("every stored assessment status has a textual presentation", () => {
  assert.deepEqual(Object.keys(ASSESSMENT_STATUS_PRESENTATIONS).sort(), [
    "CANCELLED",
    "COMPLETED",
    "EXPIRED",
    "FAILED",
    "SCHEDULED",
    "SENT",
  ]);
});

test("assessment timelines expose safe status-relevant timestamps", () => {
  const terminalKeys = {
    COMPLETED: "assessmentCompletedLabel",
    EXPIRED: "assessmentExpiredLabel",
    FAILED: "assessmentFailedLabel",
    CANCELLED: "assessmentCancelledLabel",
  };

  for (const [status, expectedKey] of Object.entries(terminalKeys)) {
    const keys = getAssessmentTimelineEntries({ ...base, status }).map(
      ({ translationKey }) => translationKey,
    );
    assert.equal(keys.at(-1), expectedKey);
  }

  assert.deepEqual(
    getAssessmentTimelineEntries({ ...base, status: "SENT" }).map(
      ({ translationKey }) => translationKey,
    ),
    ["assessmentScheduleLabel", "assessmentSentLabel", "assessmentExpiryLabel"],
  );
  assert.deepEqual(
    getAssessmentTimelineEntries({
      ...base,
      status: "SCHEDULED",
      sentAt: null,
    }),
    [
      {
        translationKey: "assessmentScheduleLabel",
        value: base.scheduledFor,
      },
    ],
  );
});
