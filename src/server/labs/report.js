import { stringify } from "csv-stringify/sync";

export const LAB_VALIDATION_REPORT_HEADERS = Object.freeze([
  "record_type",
  "row_number",
  "status",
  "mrn",
  "collected_date",
  "test_code",
  "value",
  "unit",
  "ref_low",
  "ref_high",
  "error_fields",
  "error_codes",
  "error_messages",
  "total_rows",
  "accepted_rows",
  "rejected_rows",
  "duplicate_rows",
]);

export const getLabValidationReportFilename = (importId) =>
  `lab-import-${importId}-validation-report.csv`;

export const createLabValidationReport = (labImport, messages) => {
  const records = [
    [
      "summary",
      "",
      labImport.status,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      labImport.totalRows,
      labImport.acceptedRows,
      labImport.rejectedRows,
      labImport.duplicateRows,
    ],
    ...labImport.rows.map((row) => [
      "row",
      row.rowNumber,
      row.status,
      row.normalized.mrn ?? "",
      row.normalized.collectedDate ?? "",
      row.normalized.testCode ?? "",
      row.normalized.value ?? "",
      row.normalized.unit ?? "",
      row.normalized.refLow ?? "",
      row.normalized.refHigh ?? "",
      row.errors.map(({ field }) => field ?? "").join("|"),
      row.errors.map(({ code }) => code).join("|"),
      row.errors
        .map(({ translationKey }) => messages[translationKey])
        .join("|"),
      "",
      "",
      "",
      "",
    ]),
  ];

  return stringify(records, {
    header: true,
    columns: LAB_VALIDATION_REPORT_HEADERS,
    record_delimiter: "\n",
    eof: true,
  });
};
