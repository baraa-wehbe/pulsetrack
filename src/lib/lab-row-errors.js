export const LAB_ROW_ERROR_CODES = Object.freeze({
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  UNKNOWN_MRN: "UNKNOWN_MRN",
  UNKNOWN_TEST_CODE: "UNKNOWN_TEST_CODE",
  INVALID_COLLECTED_DATE: "INVALID_COLLECTED_DATE",
  FUTURE_COLLECTED_DATE: "FUTURE_COLLECTED_DATE",
  INVALID_NUMERIC_VALUE: "INVALID_NUMERIC_VALUE",
  DUPLICATE_ROW: "DUPLICATE_ROW",
});

export const LAB_ROW_ERROR_PRESENTATIONS = Object.freeze({
  [LAB_ROW_ERROR_CODES.MISSING_REQUIRED_FIELD]: Object.freeze({
    translationKey: "labRowErrorMissingRequiredField",
    defaultField: null,
  }),
  [LAB_ROW_ERROR_CODES.UNKNOWN_MRN]: Object.freeze({
    translationKey: "labRowErrorUnknownMrn",
    defaultField: "mrn",
  }),
  [LAB_ROW_ERROR_CODES.UNKNOWN_TEST_CODE]: Object.freeze({
    translationKey: "labRowErrorUnknownTestCode",
    defaultField: "test_code",
  }),
  [LAB_ROW_ERROR_CODES.INVALID_COLLECTED_DATE]: Object.freeze({
    translationKey: "labRowErrorInvalidCollectedDate",
    defaultField: "collected_date",
  }),
  [LAB_ROW_ERROR_CODES.FUTURE_COLLECTED_DATE]: Object.freeze({
    translationKey: "labRowErrorFutureCollectedDate",
    defaultField: "collected_date",
  }),
  [LAB_ROW_ERROR_CODES.INVALID_NUMERIC_VALUE]: Object.freeze({
    translationKey: "labRowErrorInvalidNumericValue",
    defaultField: "value",
  }),
  [LAB_ROW_ERROR_CODES.DUPLICATE_ROW]: Object.freeze({
    translationKey: "labRowErrorDuplicate",
    defaultField: null,
  }),
});

const UNKNOWN_ERROR_PRESENTATION = Object.freeze({
  translationKey: "labRowErrorUnknown",
  defaultField: null,
});

export const getLabRowErrorPresentation = (error) => {
  const presentation =
    LAB_ROW_ERROR_PRESENTATIONS[error?.code] ?? UNKNOWN_ERROR_PRESENTATION;

  return {
    code:
      typeof error?.code === "string" ? error.code : "UNKNOWN_VALIDATION_ERROR",
    field:
      typeof error?.field === "string"
        ? error.field
        : presentation.defaultField,
    translationKey: presentation.translationKey,
  };
};
