import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import { createLabImport, listLabImports } from "@/server/labs/service";
import { processLabImport } from "@/server/labs/processing";
import { validateLabCsvFile } from "@/server/labs/validation";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(8).toString("hex");
let clinician;
let patient;
let mixedImportId;

test.before(async () => {
  clinician = await prisma.clinician.create({
    data: {
      email: `lab-import-${suffix}@example.test`,
      fullName: "Lab Import Test Clinician",
      passwordHash: "integration-test-hash-not-a-credential",
      status: "ACTIVE",
    },
  });
  patient = await prisma.patient.create({
    data: {
      mrn: `LAB-${suffix.toUpperCase()}`,
      firstName: "Lab",
      lastName: "Patient",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      sex: "UNKNOWN",
      createdById: clinician.id,
    },
  });
});

test.after(async () => {
  await prisma.labImport.deleteMany({ where: { uploadedById: clinician?.id } });
  await prisma.labResult.deleteMany({ where: { patientId: patient?.id } });
  await prisma.patient.deleteMany({ where: { id: patient?.id } });
  await prisma.clinician.deleteMany({ where: { id: clinician?.id } });
  await prisma.$disconnect();
});

test("valid CSV creates one processing import without storing raw content", async () => {
  const rawCsv =
    "mrn,collected_date,test_code,test_name,value,unit,ref_low,ref_high\nPT-1,2026-01-01,HBA1C,Hemoglobin A1c,6.2,%,4.0,5.6\n";
  const metadata = await validateLabCsvFile(
    new File([rawCsv], `task12-${suffix}.csv`, { type: "text/csv" }),
    1024,
  );
  const created = await createLabImport(prisma, clinician.id, metadata);

  assert.equal(created.status, "PROCESSING");
  assert.equal(created.totalRows, 0);
  assert.equal(created.originalFileName, `task12-${suffix}.csv`);

  const stored = await prisma.labImport.findUniqueOrThrow({
    where: { id: created.id },
  });
  assert.equal(stored.status, "PROCESSING");
  assert.equal(stored.fileSha256, metadata.fileSha256);
  assert.equal(JSON.stringify(stored).includes(rawCsv), false);
});

test("history is clinician-scoped and deterministically newest first", async () => {
  const history = await listLabImports(prisma, clinician.id);

  assert.equal(history.length, 1);
  assert.equal(history[0].status, "PROCESSING");
  assert.equal("fileSha256" in history[0], false);
  assert.equal("failureReason" in history[0], false);
});

test("mixed rows partially import with stable errors, counters, and authoritative catalog values", async () => {
  const mrn = patient.mrn.toLowerCase();
  const csv = [
    "mrn,collected_date,test_code,test_name,value,unit,ref_low,ref_high",
    ` ${mrn} ,2026-01-02, hba1c ,Untrusted name,6.4,bad,bad,bad`,
    `${mrn},2026-01-02,HBA1C,Duplicate,9.9,bad,bad,bad`,
    "UNKNOWN,2026-01-03,HBA1C,Unknown patient,6.2,%,4,5.6",
    `${mrn},2026-01-03,UNKNOWN,Unknown test,10,x,0,1`,
    `${mrn},2026-02-30,GLU-F,Invalid date,100,mg/dL,70,99`,
    `${mrn},2099-01-01,GLU-F,Future,100,mg/dL,70,99`,
    `${mrn},2026-01-04,GLU-F,Invalid value,NaN,mg/dL,70,99`,
    `${mrn},2026-01-05,GLU-F,Missing value,,mg/dL,70,99`,
    "",
  ].join("\n");
  const metadata = await validateLabCsvFile(
    new File([csv], `mixed-${suffix}.csv`, { type: "text/csv" }),
    4096,
  );
  const labImport = await createLabImport(prisma, clinician.id, metadata);
  mixedImportId = labImport.id;
  const result = await processLabImport(prisma, labImport.id, metadata.bytes, {
    now: new Date("2026-07-26T12:00:00.000Z"),
  });

  assert.deepEqual(
    {
      status: result.status,
      totalRows: result.totalRows,
      acceptedRows: result.acceptedRows,
      rejectedRows: result.rejectedRows,
      duplicateRows: result.duplicateRows,
    },
    {
      status: "COMPLETED_WITH_ERRORS",
      totalRows: 8,
      acceptedRows: 1,
      rejectedRows: 6,
      duplicateRows: 1,
    },
  );

  const rows = await prisma.labImportRow.findMany({
    where: { importId: labImport.id },
    orderBy: { rowNumber: "asc" },
  });
  assert.equal(rows.length, 8);
  assert.deepEqual(
    rows.map((row) => row.validationErrors.map(({ code }) => code)),
    [
      [],
      ["DUPLICATE_ROW"],
      ["UNKNOWN_MRN"],
      ["UNKNOWN_TEST_CODE"],
      ["INVALID_COLLECTED_DATE"],
      ["FUTURE_COLLECTED_DATE"],
      ["INVALID_NUMERIC_VALUE"],
      ["MISSING_REQUIRED_FIELD"],
    ],
  );
  assert.equal(rows[0].normalizedData.mrn, patient.mrn);
  assert.equal(rows[0].normalizedData.testCode, "HBA1C");
  assert.equal(rows[0].normalizedData.unit, "%");
  assert.equal(rows[0].normalizedData.refLow, "4");
  assert.equal(rows[0].normalizedData.refHigh, "5.6");

  const storedResult = await prisma.labResult.findFirstOrThrow({
    where: {
      patientId: patient.id,
      testCode: "HBA1C",
      collectedDate: new Date("2026-01-02T00:00:00.000Z"),
    },
  });
  assert.equal(storedResult.value.toString(), "6.4");
  assert.equal(storedResult.unit, "%");
  assert.equal(storedResult.refLow.toString(), "4");
  assert.equal(storedResult.refHigh.toString(), "5.6");

  const retried = await processLabImport(prisma, labImport.id, metadata.bytes, {
    now: new Date("2026-07-26T13:00:00.000Z"),
  });
  assert.deepEqual(retried, result);
  assert.equal(
    await prisma.labImportRow.count({ where: { importId: labImport.id } }),
    8,
  );
  assert.equal(
    await prisma.labResult.count({ where: { patientId: patient.id } }),
    1,
  );
});

test("import detail access and filters return every stored row exactly once", async () => {
  const { getLabImportDetail } = await import("@/server/labs/detail");
  const all = await getLabImportDetail(
    prisma,
    clinician.id,
    mixedImportId,
    "all",
  );

  assert.equal(all.rows.length, all.totalRows);
  assert.equal(
    new Set(all.rows.map(({ rowNumber }) => rowNumber)).size,
    all.totalRows,
  );
  assert.equal(
    (await getLabImportDetail(prisma, clinician.id, mixedImportId, "accepted"))
      .rows.length,
    all.acceptedRows,
  );
  assert.equal(
    (await getLabImportDetail(prisma, clinician.id, mixedImportId, "rejected"))
      .rows.length,
    all.rejectedRows,
  );
  assert.equal(
    (await getLabImportDetail(prisma, clinician.id, mixedImportId, "duplicate"))
      .rows.length,
    all.duplicateRows,
  );
  assert.equal(
    await getLabImportDetail(
      prisma,
      "00000000-0000-4000-8000-000000000000",
      mixedImportId,
      "all",
    ),
    null,
  );
});

test("corrected re-upload accepts corrected rows without duplicating prior results", async () => {
  const csv = [
    "mrn,collected_date,test_code,test_name,value,unit,ref_low,ref_high",
    `${patient.mrn},2026-01-02,HBA1C,Existing,6.4,%,4,5.6`,
    `${patient.mrn},2026-01-03,GLU-F,Corrected,101,ignored,0,0`,
    "",
  ].join("\n");
  const metadata = await validateLabCsvFile(
    new File([csv], `corrected-${suffix}.csv`, { type: "text/csv" }),
    4096,
  );
  const labImport = await createLabImport(prisma, clinician.id, metadata);
  const result = await processLabImport(prisma, labImport.id, metadata.bytes, {
    now: new Date("2026-07-26T14:00:00.000Z"),
  });

  assert.equal(result.status, "COMPLETED_WITH_ERRORS");
  assert.equal(result.acceptedRows, 1);
  assert.equal(result.rejectedRows, 0);
  assert.equal(result.duplicateRows, 1);
  assert.equal(
    await prisma.labResult.count({ where: { patientId: patient.id } }),
    2,
  );
  const accepted = await prisma.labResult.findFirstOrThrow({
    where: {
      patientId: patient.id,
      testCode: "GLU-F",
      collectedDate: new Date("2026-01-03T00:00:00.000Z"),
    },
  });
  assert.equal(accepted.unit, "mg/dL");
  assert.equal(accepted.refLow.toString(), "70");
  assert.equal(accepted.refHigh.toString(), "99");
});
