import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LAB_IMPORT_STATUS_PRESENTATIONS,
  getLabImportStatusPresentation,
} from "@/lib/lab-import-presentation";
import { listLabImports } from "@/server/labs/service";
import {
  LAB_CSV_REQUIRED_HEADERS,
  LAB_CSV_TEMPLATE_FILENAME,
  readLabCsvTemplate,
} from "@/server/labs/template";
import { createLabTemplateDownloadHandler } from "@/server/labs/template-http";
import {
  LabUploadValidationError,
  validateLabCsvFile,
} from "@/server/labs/validation";
import {
  LAB_ROW_ERROR_CODES,
  normalizeLabCollectedDate,
  normalizeLabCsvRow,
  parseLabCsvRows,
  validateNormalizedLabRow,
} from "@/server/labs/processing";

const templateContent = [
  "mrn,collected_date,test_code,test_name,value,unit,ref_low,ref_high",
  "MRN-1001,2026-06-01,GLU-F,Fasting Glucose,105,mg/dL,70,99",
  "MRN-1001,2026-06-01,HBA1C,Hemoglobin A1c,6.8,%,4.0,5.6",
  "",
].join("\n");

const expectUploadError = async (file, maximumBytes, code) => {
  await assert.rejects(
    validateLabCsvFile(file, maximumBytes),
    (error) => error instanceof LabUploadValidationError && error.code === code,
  );
};

test("template preserves the supplied filename and exact byte content", async () => {
  const template = await readLabCsvTemplate();

  assert.equal(LAB_CSV_TEMPLATE_FILENAME, "lab-results-template.csv");
  assert.equal(template.toString("utf8"), templateContent);
  assert.equal(template.byteLength, 180);
  assert.equal(
    createHash("sha256").update(template).digest("hex"),
    "33e8a4e8c003ed2cf8a3ac4708b8acb135b572d370ca548bcc8fed8819b77b64",
  );
  assert.deepEqual(LAB_CSV_REQUIRED_HEADERS, [
    "mrn",
    "collected_date",
    "test_code",
    "test_name",
    "value",
    "unit",
    "ref_low",
    "ref_high",
  ]);
});

test("template download preserves exact response bytes and original filename", async () => {
  const handler = createLabTemplateDownloadHandler({
    readTemplate: async () => Buffer.from(templateContent),
  });
  const response = await handler();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="lab-results-template.csv"',
  );
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), templateContent);
});

test("valid CSV metadata is normalized safely and content is hashed", async () => {
  const file = new File([templateContent], "lab-upload.csv", {
    type: "text/csv",
  });
  const result = await validateLabCsvFile(file, 1024);

  assert.equal(result.originalFileName, "lab-upload.csv");
  assert.equal(
    result.fileSha256,
    createHash("sha256").update(templateContent).digest("hex"),
  );
  assert.equal(JSON.stringify(result).includes(templateContent), false);
});

test("UTF-8 BOM files exported by spreadsheet apps are accepted", async () => {
  const file = new File([`\uFEFF${templateContent}`], "spreadsheet.csv", {
    type: "text/csv",
  });

  const result = await validateLabCsvFile(file, 1024);

  assert.equal(result.originalFileName, "spreadsheet.csv");
});

test("lab rows trim fields and normalize MRN and test code", () => {
  const csv = [
    "mrn,collected_date,test_code,test_name,value,unit,ref_low,ref_high",
    " pt-100 , 2026-01-02 , hba1c , ignored , 6.4 , ignored , ignored , ignored ",
    "",
  ].join("\n");
  const rows = parseLabCsvRows(Buffer.from(csv));
  const normalized = normalizeLabCsvRow(rows[0].fields);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].rowNumber, 2);
  assert.deepEqual(normalized, {
    mrn: "PT-100",
    collectedDate: "2026-01-02",
    testCode: "HBA1C",
    value: "6.4",
  });
});

test("lab dates accept common spreadsheet formats and normalize to ISO", () => {
  for (const [input, expected] of [
    ["2026-07-02", "2026-07-02"],
    ["2026/7/2", "2026-07-02"],
    ["7/2/2026", "2026-07-02"],
    ["07/02/2026", "2026-07-02"],
    ["7-2-2026", "2026-07-02"],
    ["7/28/2026", "2026-07-28"],
  ]) {
    assert.equal(normalizeLabCollectedDate(input), expected);
  }

  for (const invalid of [
    "2026-02-30",
    "2/30/2026",
    "28/7/2026",
    "7/2/26",
    "July 2, 2026",
  ]) {
    assert.equal(normalizeLabCollectedDate(invalid), null);
  }

  const fields = {
    mrn: "PT-100",
    collected_date: "7/2/2026",
    test_code: "HBA1C",
    value: "6.4",
  };
  assert.equal(normalizeLabCsvRow(fields).collectedDate, "2026-07-02");
});

test("row validation emits every required stable error code", () => {
  const patient = { id: "patient-1", mrn: "PT-100" };
  const testDefinition = {
    code: "HBA1C",
    defaultUnit: "%",
    defaultRefLow: "4",
    defaultRefHigh: "5.6",
  };
  const context = {
    activePatientsByMrn: new Map([["PT-100", patient]]),
    activeTestsByCode: new Map([["HBA1C", testDefinition]]),
    today: "2026-07-26",
  };
  const validate = (overrides) => {
    const fields = {
      mrn: "PT-100",
      collected_date: "2026-01-02",
      test_code: "HBA1C",
      test_name: "",
      value: "6.4",
      unit: "",
      ref_low: "",
      ref_high: "",
      ...overrides,
    };
    return validateNormalizedLabRow(
      fields,
      normalizeLabCsvRow(fields),
      context,
    ).errors.map(({ code }) => code);
  };

  assert.deepEqual(validate({ value: "" }), [
    LAB_ROW_ERROR_CODES.MISSING_REQUIRED_FIELD,
  ]);
  assert.deepEqual(validate({ mrn: "UNKNOWN" }), [
    LAB_ROW_ERROR_CODES.UNKNOWN_MRN,
  ]);
  assert.deepEqual(validate({ test_code: "UNKNOWN" }), [
    LAB_ROW_ERROR_CODES.UNKNOWN_TEST_CODE,
  ]);
  assert.deepEqual(validate({ collected_date: "2026-02-30" }), [
    LAB_ROW_ERROR_CODES.INVALID_COLLECTED_DATE,
  ]);
  assert.deepEqual(validate({ collected_date: "7/2/2026" }), []);
  assert.deepEqual(validate({ collected_date: "7/27/2026" }), [
    LAB_ROW_ERROR_CODES.FUTURE_COLLECTED_DATE,
  ]);
  assert.deepEqual(validate({ collected_date: "2026-07-27" }), [
    LAB_ROW_ERROR_CODES.FUTURE_COLLECTED_DATE,
  ]);
  for (const value of ["NaN", "Infinity", "1e3", "12.12345"]) {
    assert.deepEqual(validate({ value }), [
      LAB_ROW_ERROR_CODES.INVALID_NUMERIC_VALUE,
    ]);
  }
});

test("missing, non-CSV, empty, and oversized uploads are rejected", async () => {
  await expectUploadError(null, 1024, "FILE_REQUIRED");
  await expectUploadError(
    new File(["content"], "notes.txt", { type: "text/plain" }),
    1024,
    "CSV_REQUIRED",
  );
  await expectUploadError(
    new File([], "empty.csv", { type: "text/csv" }),
    1024,
    "FILE_EMPTY",
  );
  await expectUploadError(
    new File(["x".repeat(1025)], "large.csv", { type: "text/csv" }),
    1024,
    "FILE_TOO_LARGE",
  );
});

test("missing, reordered, additional, and incorrect headers are rejected", async () => {
  for (const header of [
    "",
    "mrn,collected_date,test_code",
    "collected_date,mrn,test_code,test_name,value,unit,ref_low,ref_high",
    `${LAB_CSV_REQUIRED_HEADERS.join(",")},extra`,
    "MRN,collected_date,test_code,test_name,value,unit,ref_low,ref_high",
  ]) {
    await expectUploadError(
      new File([`${header}\nrow`], "headers.csv", { type: "text/csv" }),
      1024,
      header ? "INVALID_HEADERS" : "INVALID_HEADERS",
    );
  }
});

test("history query is clinician-scoped, newest first, and safely serialized", async () => {
  const now = new Date("2026-07-26T12:00:00.000Z");
  let query;
  const imports = await listLabImports(
    {
      labImport: {
        findMany: async (value) => {
          query = value;
          return [
            {
              id: "import-2",
              originalFileName: "new.csv",
              status: "PROCESSING",
              totalRows: 0,
              acceptedRows: 0,
              rejectedRows: 0,
              duplicateRows: 0,
              startedAt: now,
              completedAt: null,
              createdAt: now,
              fileSha256: "must-not-serialize",
              failureReason: "must-not-serialize",
            },
          ];
        },
      },
    },
    "clinician-1",
  );

  assert.deepEqual(query.where, { uploadedById: "clinician-1" });
  assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(imports[0].originalFileName, "new.csv");
  assert.doesNotMatch(JSON.stringify(imports), /fileSha256|failureReason/);
});

test("every stored import status has readable presentation and unknown is safe", () => {
  assert.deepEqual(Object.keys(LAB_IMPORT_STATUS_PRESENTATIONS).sort(), [
    "COMPLETED",
    "COMPLETED_WITH_ERRORS",
    "FAILED",
    "PROCESSING",
  ]);
  assert.equal(
    getLabImportStatusPresentation("PROCESSING").translationKey,
    "labImportStatusProcessing",
  );
  assert.equal(
    getLabImportStatusPresentation("UNRECOGNIZED").translationKey,
    "labImportStatusUnknown",
  );
});

test("lab upload UI and API remain protected, accessible, and server parsed", async () => {
  const [page, detailPage, form, reportLink, route, templateRoute, validation] =
    await Promise.all([
      readFile("src/app/(private)/lab-uploads/page.js", "utf8"),
      readFile("src/app/(private)/lab-uploads/[importId]/page.js", "utf8"),
      readFile("src/components/lab-csv-upload-form.js", "utf8"),
      readFile("src/components/lab-import-report-link.js", "utf8"),
      readFile("src/app/api/private/lab-imports/route.js", "utf8"),
      readFile("src/app/api/private/lab-imports/template/route.js", "utf8"),
      readFile("src/server/labs/validation.js", "utf8"),
    ]);

  assert.match(page, /requireCurrentClinician/);
  assert.match(page, /<table/);
  assert.match(page, /scope="col"/);
  assert.match(page, /md:hidden/);
  assert.match(form, /<label/);
  assert.match(form, /type="file"/);
  assert.match(form, /aria-invalid/);
  assert.match(form, /router\.refresh/);
  assert.doesNotMatch(form, /router\.push/);
  assert.match(form, /status=\$\{filter\}/);
  assert.match(form, /labUploadReportHint/);
  assert.match(form, /viewImportValidation/);
  assert.match(route, /server\/labs\/http/);
  assert.match(templateRoute, /withClinicianAuthentication/);
  assert.match(validation, /createHash\("sha256"\)/);
  assert.match(
    await readFile("src/server/labs/http.js", "utf8"),
    /processLabImport/,
  );
  assert.match(page, /acceptedRows/);
  assert.match(page, /rejectedRows/);
  assert.match(page, /duplicateRows/);
  assert.match(page, /lg:grid-cols-2/);
  assert.match(page, /labTemplateHeading/);
  assert.match(page, /<LabImportReportLink/);
  assert.match(
    page,
    /bg-teal-100\/80 px-4 py-3 text-center font-bold text-teal-900/,
  );
  assert.equal(
    [
      ...page.matchAll(
        /<th(?:\s|>)[\s\S]*?className="([^"]+)"[\s\S]*?scope="col"/g,
      ),
    ].every(([, className]) => className.includes("text-center")),
    true,
  );
  assert.equal(
    [
      ...detailPage.matchAll(
        /<th(?:\s|>)[\s\S]*?className="([^"]+)"[\s\S]*?scope="col"/g,
      ),
    ].every(([, className]) => className.includes("text-center")),
    true,
  );
  assert.match(reportLink, /viewImportReportTooltip/);
  assert.match(reportLink, /role="tooltip"/);
  assert.doesNotMatch(form, /createHash|fileSha256|prisma/);
});
