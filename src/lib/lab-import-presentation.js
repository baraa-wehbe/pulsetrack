const UNKNOWN_PRESENTATION = Object.freeze({
  translationKey: "labImportStatusUnknown",
  className:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
});

export const LAB_IMPORT_STATUS_PRESENTATIONS = Object.freeze({
  PROCESSING: Object.freeze({
    translationKey: "labImportStatusProcessing",
    className:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  }),
  COMPLETED: Object.freeze({
    translationKey: "labImportStatusCompleted",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  }),
  COMPLETED_WITH_ERRORS: Object.freeze({
    translationKey: "labImportStatusCompletedWithErrors",
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  }),
  FAILED: Object.freeze({
    translationKey: "labImportStatusFailed",
    className:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  }),
});

export const getLabImportStatusPresentation = (status) =>
  LAB_IMPORT_STATUS_PRESENTATIONS[status] ?? UNKNOWN_PRESENTATION;
