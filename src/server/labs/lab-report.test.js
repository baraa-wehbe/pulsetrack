import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parse } from "csv-parse/sync";

import { getTranslations } from "@/i18n/translations";
import {
  buildLabImportDetailHref,
  parseLabRowFilter,
} from "@/lib/lab-import-detail";
import { getLabImportDetail } from "@/server/labs/detail";
import {
  createLabValidationReport,
  getLabValidationReportFilename,
} from "@/server/labs/report";
import { createLabValidationReportHandler } from "@/server/labs/report-http";

const IMPORT_ID = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-07-26T12:00:00.000Z");
const databaseImport = {
  id: IMPORT_ID,
  originalFileName: "safe.csv",
  status: "COMPLETED_WITH_ERRORS",
  totalRows: 3,
  acceptedRows: 1,
  rejectedRows: 1,
  duplicateRows: 1,
  startedAt: now,
  completedAt: now,
  createdAt: now,
  fileSha256: "must-not-serialize",
  failureReason: "must-not-serialize",
  rows: [
    {
      id: "row-1",
      rowNumber: 2,
      status: "ACCEPTED",
      normalizedData: {
        mrn: "PT-1",
        collectedDate: "2026-01-01",
        testCode: "HBA1C",
        value: "6.2",
        unit: "%",
        refLow: "4",
        refHigh: "5.6",
      },
      validationErrors: [],
      rawData: { secret: "must-not-serialize" },
    },
    {
      id: "row-2",
      rowNumber: 3,
      status: "REJECTED",
      normalizedData: {
        mrn: "UNKNOWN",
        collectedDate: "2026-01-01",
        testCode: "HBA1C",
        value: "6.2",
      },
      validationErrors: [{ code: "UNKNOWN_MRN", field: "mrn" }],
      rawData: { secret: "must-not-serialize" },
    },
    {
      id: "row-3",
      rowNumber: 4,
      status: "DUPLICATE",
      normalizedData: {
        mrn: "PT-1",
        collectedDate: "2026-01-01",
        testCode: "HBA1C",
        value: "6.2",
      },
      validationErrors: [{ code: "DUPLICATE_ROW" }],
      rawData: { secret: "must-not-serialize" },
    },
  ],
};

const createDetailPrisma = () => {
  const calls = [];
  return {
    calls,
    labImport: {
      findFirst: async (query) => {
        calls.push(query);
        if (
          query.where.id !== IMPORT_ID ||
          query.where.uploadedById !== "clinician-1"
        ) {
          return null;
        }
        const status = query.select.rows.where?.status;
        return {
          ...databaseImport,
          rows: status
            ? databaseImport.rows.filter((row) => row.status === status)
            : databaseImport.rows,
        };
      },
    },
  };
};

test("detail access is clinician-scoped and safely serialized", async () => {
  const prisma = createDetailPrisma();
  const detail = await getLabImportDetail(
    prisma,
    "clinician-1",
    IMPORT_ID,
    "all",
  );

  assert.deepEqual(prisma.calls[0].where, {
    id: IMPORT_ID,
    uploadedById: "clinician-1",
  });
  assert.deepEqual(
    detail.rows.map(({ rowNumber }) => rowNumber),
    [2, 3, 4],
  );
  assert.equal(new Set(detail.rows.map(({ rowNumber }) => rowNumber)).size, 3);
  assert.equal(detail.rows[1].errors[0].field, "mrn");
  assert.doesNotMatch(
    JSON.stringify(detail),
    /fileSha256|failureReason|rawData|must-not-serialize/,
  );
  assert.equal(
    await getLabImportDetail(prisma, "another-clinician", IMPORT_ID, "all"),
    null,
  );
});

test("accepted, rejected, and duplicate filters map to stored statuses", async () => {
  for (const [filter, expectedStatus] of [
    ["accepted", "ACCEPTED"],
    ["rejected", "REJECTED"],
    ["duplicate", "DUPLICATE"],
  ]) {
    const prisma = createDetailPrisma();
    const detail = await getLabImportDetail(
      prisma,
      "clinician-1",
      IMPORT_ID,
      filter,
    );
    assert.equal(prisma.calls[0].select.rows.where.status, expectedStatus);
    assert.deepEqual(
      detail.rows.map(({ status }) => status),
      [expectedStatus],
    );
  }
  assert.equal(parseLabRowFilter({ status: "unsupported" }), "all");
  assert.equal(
    buildLabImportDetailHref(IMPORT_ID, "rejected"),
    `/lab-uploads/${IMPORT_ID}?status=rejected`,
  );
});

test("validation report is deterministic, complete, and counter-consistent", async () => {
  const detail = await getLabImportDetail(
    createDetailPrisma(),
    "clinician-1",
    IMPORT_ID,
    "all",
  );
  const report = createLabValidationReport(detail, getTranslations("en"));
  const records = parse(report, { columns: true });
  const summary = records[0];
  const rows = records.filter(({ record_type }) => record_type === "row");

  assert.equal(
    getLabValidationReportFilename(IMPORT_ID),
    `lab-import-${IMPORT_ID}-validation-report.csv`,
  );
  assert.equal(rows.length, detail.totalRows);
  assert.deepEqual(
    rows.map(({ row_number }) => row_number),
    ["2", "3", "4"],
  );
  assert.equal(summary.total_rows, "3");
  assert.equal(summary.accepted_rows, "1");
  assert.equal(summary.rejected_rows, "1");
  assert.equal(summary.duplicate_rows, "1");
  assert.equal(
    rows.filter(({ status }) => status === "ACCEPTED").length,
    Number(summary.accepted_rows),
  );
  assert.equal(
    rows.filter(({ status }) => status === "REJECTED").length,
    Number(summary.rejected_rows),
  );
  assert.equal(
    rows.filter(({ status }) => status === "DUPLICATE").length,
    Number(summary.duplicate_rows),
  );
  assert.equal(rows[1].error_fields, "mrn");
  assert.equal(rows[1].error_codes, "UNKNOWN_MRN");
  assert.match(rows[1].error_messages, /active patient/);
  assert.doesNotMatch(report, /must-not-serialize/);
});

test("report handler returns safe not-found and sanitized failure responses", async () => {
  const logged = [];
  const handler = createLabValidationReportHandler({
    prismaClient: createDetailPrisma(),
    onInternalError: (...values) => logged.push(values),
  });
  const request = {
    cookies: { get: () => undefined },
  };
  const downloaded = await handler(request, {
    clinician: { id: "clinician-1" },
    params: Promise.resolve({ importId: IMPORT_ID }),
  });
  assert.equal(downloaded.status, 200);
  assert.equal(
    downloaded.headers.get("content-disposition"),
    `attachment; filename="lab-import-${IMPORT_ID}-validation-report.csv"`,
  );
  assert.equal(
    parse(await downloaded.text(), { columns: true }).filter(
      ({ record_type }) => record_type === "row",
    ).length,
    3,
  );

  const notFound = await handler(request, {
    clinician: { id: "another-clinician" },
    params: Promise.resolve({ importId: IMPORT_ID }),
  });
  assert.equal(notFound.status, 404);
  assert.deepEqual(await notFound.json(), {
    error: "Lab import not found.",
  });

  const secret = "database-secret-must-not-leak";
  const failedHandler = createLabValidationReportHandler({
    prismaClient: {
      labImport: {
        findFirst: async () => {
          throw new Error(secret);
        },
      },
    },
    onInternalError: (...values) => logged.push(values),
  });
  const failed = await failedHandler(request, {
    clinician: { id: "clinician-1" },
    params: Promise.resolve({ importId: IMPORT_ID }),
  });
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: "Internal server error." });
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(secret));
});

test("history and detail UI expose protected links, filters, and safe states", async () => {
  const [history, page, route, loading, error, notFound] = await Promise.all([
    readFile("src/app/(private)/lab-uploads/page.js", "utf8"),
    readFile("src/app/(private)/lab-uploads/[importId]/page.js", "utf8"),
    readFile(
      "src/app/api/private/lab-imports/[importId]/report/route.js",
      "utf8",
    ),
    readFile("src/app/(private)/lab-uploads/[importId]/loading.js", "utf8"),
    readFile("src/app/(private)/lab-uploads/[importId]/error.js", "utf8"),
    readFile("src/app/(private)/lab-uploads/[importId]/not-found.js", "utf8"),
  ]);

  assert.match(
    history,
    /lab-uploads\/\$\{encodeURIComponent\(labImport\.id\)\}/,
  );
  assert.match(page, /requireCurrentClinician/);
  assert.match(page, /parseLabRowFilter/);
  assert.match(page, /aria-current/);
  assert.match(page, /<table/);
  assert.match(page, /md:hidden/);
  assert.doesNotMatch(page, /rawData|fileSha256|failureReason/);
  assert.match(route, /withClinicianAuthentication/);
  assert.match(loading, /role="status"/);
  assert.match(error, /role="alert"/);
  assert.doesNotMatch(error, /error\.message/);
  assert.match(notFound, /labImportNotFoundTitle/);
});
