const UNKNOWN_PRESENTATION = Object.freeze({
  translationKey: "assessmentUnknown",
  variant: "neutral",
});

export const ASSESSMENT_STATUS_PRESENTATIONS = Object.freeze({
  NOT_SENT: Object.freeze({
    translationKey: "assessmentNotSent",
    variant: "neutral",
  }),
  SCHEDULED: Object.freeze({
    translationKey: "assessmentScheduled",
    variant: "amber",
  }),
  SENT: Object.freeze({
    translationKey: "assessmentSent",
    variant: "blue",
  }),
  COMPLETED: Object.freeze({
    translationKey: "assessmentCompleted",
    variant: "green",
  }),
  EXPIRED: Object.freeze({
    translationKey: "assessmentExpired",
    variant: "orange",
  }),
  FAILED: Object.freeze({
    translationKey: "assessmentFailed",
    variant: "red",
  }),
  CANCELLED: Object.freeze({
    translationKey: "assessmentCancelled",
    variant: "neutral",
  }),
});

export const RISK_PRESENTATIONS = Object.freeze({
  LOW: Object.freeze({
    translationKey: "riskLow",
    guidanceKey: "riskLowGuidance",
    variant: "green",
  }),
  MODERATE: Object.freeze({
    translationKey: "riskModerate",
    guidanceKey: "riskModerateGuidance",
    variant: "amber",
  }),
  HIGH: Object.freeze({
    translationKey: "riskHigh",
    guidanceKey: "riskHighGuidance",
    variant: "orange",
  }),
  VERY_HIGH: Object.freeze({
    translationKey: "riskVeryHigh",
    guidanceKey: "riskVeryHighGuidance",
    variant: "red",
  }),
});

export const getAssessmentStatusPresentation = (status) =>
  ASSESSMENT_STATUS_PRESENTATIONS[status] ?? UNKNOWN_PRESENTATION;

export const getAssessmentTimelineEntries = (assessment) => {
  const entries = [
    {
      translationKey: "assessmentScheduleLabel",
      value: assessment.scheduledFor,
    },
  ];

  if (assessment.sentAt) {
    entries.push({
      translationKey: "assessmentSentLabel",
      value: assessment.sentAt,
    });
  }

  const terminalEntry = {
    COMPLETED: {
      translationKey: "assessmentCompletedLabel",
      value: assessment.completedAt,
    },
    EXPIRED: {
      translationKey: "assessmentExpiredLabel",
      value: assessment.expiresAt,
    },
    FAILED: {
      translationKey: "assessmentFailedLabel",
      value: assessment.updatedAt,
    },
    CANCELLED: {
      translationKey: "assessmentCancelledLabel",
      value: assessment.cancelledAt,
    },
  }[assessment.status];

  if (terminalEntry?.value) {
    entries.push(terminalEntry);
  } else if (assessment.status === "SENT" && assessment.expiresAt) {
    entries.push({
      translationKey: "assessmentExpiryLabel",
      value: assessment.expiresAt,
    });
  }

  return entries;
};

export const getRiskPresentation = (riskBand) =>
  RISK_PRESENTATIONS[riskBand] ?? {
    ...UNKNOWN_PRESENTATION,
    guidanceKey: "riskUnknownGuidance",
  };
