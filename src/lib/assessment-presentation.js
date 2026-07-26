const UNKNOWN_PRESENTATION = Object.freeze({
  translationKey: "assessmentUnknown",
  variant: "neutral",
});

export const ASSESSMENT_STATUS_PRESENTATIONS = Object.freeze({
  SCHEDULED: Object.freeze({
    translationKey: "assessmentScheduled",
    variant: "blue",
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
    variant: "amber",
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

export const getRiskPresentation = (riskBand) =>
  RISK_PRESENTATIONS[riskBand] ?? {
    ...UNKNOWN_PRESENTATION,
    guidanceKey: "riskUnknownGuidance",
  };
