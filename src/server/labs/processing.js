import { parse } from "csv-parse/sync";

import { LAB_ROW_ERROR_CODES } from "@/lib/lab-row-errors";
import { normalizePatientMrn } from "@/lib/patient-validation";
import { enqueueAcceptedObservationSyncs } from "@/server/fhir/observation-sync-queue";
import { LAB_CSV_REQUIRED_HEADERS } from "@/server/labs/template";

export { LAB_ROW_ERROR_CODES } from "@/lib/lab-row-errors";

const REQUIRED_FIELDS = Object.freeze([
  "mrn",
  "collected_date",
  "test_code",
  "value",
]);
const ISO_DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const MONTH_FIRST_DATE_PATTERN = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const DECIMAL_PATTERN = /^[+-]?\d{1,8}(?:\.\d{1,4})?$/;

const dateOnlyFromClock = (value) => value.toISOString().slice(0, 10);

export const normalizeLabCollectedDate = (value) => {
  const isoMatch = ISO_DATE_PATTERN.exec(value);
  const monthFirstMatch = MONTH_FIRST_DATE_PATTERN.exec(value);
  const parts = isoMatch
    ? {
        year: Number(isoMatch[1]),
        month: Number(isoMatch[2]),
        day: Number(isoMatch[3]),
      }
    : monthFirstMatch
      ? {
          year: Number(monthFirstMatch[3]),
          month: Number(monthFirstMatch[1]),
          day: Number(monthFirstMatch[2]),
        }
      : null;

  if (!parts) return null;

  const { year, month, day } = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  ) {
    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  }

  return null;
};

const isSafeDecimal = (value) =>
  DECIMAL_PATTERN.test(value) && Number.isFinite(Number(value));

const trimRecord = (record) =>
  Object.fromEntries(
    LAB_CSV_REQUIRED_HEADERS.map((header) => [
      header,
      typeof record[header] === "string" ? record[header].trim() : "",
    ]),
  );

export const parseLabCsvRows = (bytes) =>
  parse(bytes, {
    columns: LAB_CSV_REQUIRED_HEADERS,
    from_line: 2,
    relax_column_count: true,
    skip_empty_lines: false,
  }).map((record, index) => ({
    rowNumber: index + 2,
    fields: trimRecord(record),
  }));

export const normalizeLabCsvRow = (fields) => ({
  mrn: normalizePatientMrn(fields.mrn),
  collectedDate:
    normalizeLabCollectedDate(fields.collected_date) ?? fields.collected_date,
  testCode: fields.test_code.toUpperCase(),
  value: fields.value,
});

const rowIdentity = (patientId, collectedDate, testCode) =>
  `${patientId}\u0000${collectedDate}\u0000${testCode}`;

const validationError = (code, field = null) =>
  field ? { code, field } : { code };

export const validateNormalizedLabRow = (
  fields,
  normalized,
  { activePatientsByMrn, activeTestsByCode, today },
) => {
  const errors = [];

  for (const field of REQUIRED_FIELDS.filter((field) => !fields[field])) {
    errors.push(
      validationError(LAB_ROW_ERROR_CODES.MISSING_REQUIRED_FIELD, field),
    );
  }

  const normalizedDate = normalizeLabCollectedDate(fields.collected_date);
  if (normalized.collectedDate && !normalizedDate) {
    errors.push(
      validationError(
        LAB_ROW_ERROR_CODES.INVALID_COLLECTED_DATE,
        "collected_date",
      ),
    );
  } else if (normalizedDate && normalizedDate > today) {
    errors.push(
      validationError(
        LAB_ROW_ERROR_CODES.FUTURE_COLLECTED_DATE,
        "collected_date",
      ),
    );
  }

  if (normalized.value && !isSafeDecimal(normalized.value)) {
    errors.push(
      validationError(LAB_ROW_ERROR_CODES.INVALID_NUMERIC_VALUE, "value"),
    );
  }

  const patient = activePatientsByMrn.get(normalized.mrn);
  if (normalized.mrn && !patient) {
    errors.push(validationError(LAB_ROW_ERROR_CODES.UNKNOWN_MRN, "mrn"));
  }

  const test = activeTestsByCode.get(normalized.testCode);
  if (normalized.testCode && !test) {
    errors.push(
      validationError(LAB_ROW_ERROR_CODES.UNKNOWN_TEST_CODE, "test_code"),
    );
  }

  return { errors, patient, test };
};

const safeImportSummary = (labImport) => ({
  id: labImport.id,
  status: labImport.status,
  totalRows: labImport.totalRows,
  acceptedRows: labImport.acceptedRows,
  rejectedRows: labImport.rejectedRows,
  duplicateRows: labImport.duplicateRows,
  completedAt: labImport.completedAt?.toISOString() ?? null,
});

const processLabImportTransaction = async (
  prismaClient,
  importId,
  bytes,
  { now = new Date() } = {},
) =>
  prismaClient.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${importId}::text, 0)
        ) IS NULL AS "claimed"
      `;

      const labImport = await transaction.labImport.findUnique({
        where: { id: importId },
        select: {
          id: true,
          status: true,
          totalRows: true,
          acceptedRows: true,
          rejectedRows: true,
          duplicateRows: true,
          completedAt: true,
        },
      });
      if (!labImport) {
        throw new Error("Lab import not found.");
      }
      if (labImport.status !== "PROCESSING") {
        return safeImportSummary(labImport);
      }

      const rows = parseLabCsvRows(bytes);
      const normalizedRows = rows.map((row) => ({
        ...row,
        normalized: normalizeLabCsvRow(row.fields),
      }));
      const mrns = [
        ...new Set(
          normalizedRows
            .map(({ normalized }) => normalized.mrn)
            .filter(Boolean),
        ),
      ];
      const testCodes = [
        ...new Set(
          normalizedRows
            .map(({ normalized }) => normalized.testCode)
            .filter(Boolean),
        ),
      ];
      const [patients, tests] = await Promise.all([
        transaction.patient.findMany({
          where: { mrn: { in: mrns }, archivedAt: null },
          select: { id: true, mrn: true },
        }),
        transaction.labTest.findMany({
          where: { code: { in: testCodes }, isActive: true },
          select: {
            code: true,
            defaultUnit: true,
            defaultRefLow: true,
            defaultRefHigh: true,
          },
        }),
      ]);
      const activePatientsByMrn = new Map(
        patients.map((patient) => [patient.mrn, patient]),
      );
      const activeTestsByCode = new Map(tests.map((test) => [test.code, test]));
      const seen = new Set();
      const today = dateOnlyFromClock(now);
      const processedRows = [];

      for (const row of normalizedRows) {
        const { errors, patient, test } = validateNormalizedLabRow(
          row.fields,
          row.normalized,
          { activePatientsByMrn, activeTestsByCode, today },
        );
        const normalizedData = {
          mrn: row.normalized.mrn,
          collectedDate: row.normalized.collectedDate || null,
          testCode: row.normalized.testCode,
          value: row.normalized.value || null,
          unit: test?.defaultUnit ?? null,
          refLow: test?.defaultRefLow?.toString() ?? null,
          refHigh: test?.defaultRefHigh?.toString() ?? null,
        };
        let status = "REJECTED";
        let identity = null;

        if (errors.length === 0) {
          identity = rowIdentity(
            patient.id,
            row.normalized.collectedDate,
            test.code,
          );
          if (seen.has(identity)) {
            errors.push(validationError(LAB_ROW_ERROR_CODES.DUPLICATE_ROW));
            status = "DUPLICATE";
          } else {
            seen.add(identity);
            status = "CANDIDATE";
          }
        }

        processedRows.push({
          errors,
          identity,
          normalizedData,
          patient,
          row,
          status,
          test,
        });
      }

      const candidates = processedRows.filter(
        ({ status }) => status === "CANDIDATE",
      );
      const insertedResults =
        candidates.length === 0
          ? []
          : await transaction.labResult.createManyAndReturn({
              data: candidates.map(({ patient, row, test }) => ({
                patientId: patient.id,
                testCode: test.code,
                collectedDate: new Date(
                  `${row.normalized.collectedDate}T00:00:00.000Z`,
                ),
                value: row.normalized.value,
                unit: test.defaultUnit,
                refLow: test.defaultRefLow,
                refHigh: test.defaultRefHigh,
                source: "CSV",
                fhirSyncStatus: "PENDING",
                createdAt: now,
                updatedAt: now,
              })),
              skipDuplicates: true,
              select: {
                id: true,
                patientId: true,
                testCode: true,
                collectedDate: true,
              },
            });
      const insertedByIdentity = new Map(
        insertedResults.map((result) => [
          rowIdentity(
            result.patientId,
            dateOnlyFromClock(result.collectedDate),
            result.testCode,
          ),
          result.id,
        ]),
      );
      let acceptedRows = 0;
      let rejectedRows = 0;
      let duplicateRows = 0;
      const importRows = processedRows.map((processed) => {
        let { status } = processed;
        let labResultId = null;

        if (status === "CANDIDATE") {
          labResultId = insertedByIdentity.get(processed.identity) ?? null;
          status = labResultId ? "ACCEPTED" : "DUPLICATE";
          if (!labResultId) {
            processed.errors.push(
              validationError(LAB_ROW_ERROR_CODES.DUPLICATE_ROW),
            );
          }
        }

        if (status === "ACCEPTED") acceptedRows += 1;
        else if (status === "DUPLICATE") duplicateRows += 1;
        else rejectedRows += 1;

        return {
          importId,
          rowNumber: processed.row.rowNumber,
          status,
          // Normalized values and stable validation errors are sufficient for
          // the validation report. Do not duplicate the uploaded PHI-heavy
          // source row after processing.
          rawData: {},
          normalizedData: processed.normalizedData,
          validationErrors: processed.errors,
          labResultId,
        };
      });

      if (importRows.length > 0) {
        await transaction.labImportRow.createMany({ data: importRows });
      }

      const totalRows = normalizedRows.length;
      const status =
        rejectedRows > 0 || duplicateRows > 0
          ? "COMPLETED_WITH_ERRORS"
          : "COMPLETED";
      const completed = await transaction.labImport.update({
        where: { id: importId },
        data: {
          status,
          totalRows,
          acceptedRows,
          rejectedRows,
          duplicateRows,
          completedAt: now,
          failureReason: null,
        },
        select: {
          id: true,
          status: true,
          totalRows: true,
          acceptedRows: true,
          rejectedRows: true,
          duplicateRows: true,
          completedAt: true,
        },
      });

      return safeImportSummary(completed);
    },
    { maxWait: 5_000, timeout: 30_000 },
  );

export const processLabImport = async (
  prismaClient,
  importId,
  bytes,
  options,
) => {
  const summary = await processLabImportTransaction(
    prismaClient,
    importId,
    bytes,
    options,
  );
  await enqueueAcceptedObservationSyncs(prismaClient, importId);
  return summary;
};
