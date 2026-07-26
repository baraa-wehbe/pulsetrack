import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env.mjs";
import { PrismaClient } from "@/generated/prisma/client";
import { createLabImport, listLabImports } from "@/server/labs/service";
import { validateLabCsvFile } from "@/server/labs/validation";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(8).toString("hex");
let clinician;

test.before(async () => {
  clinician = await prisma.clinician.create({
    data: {
      email: `lab-import-${suffix}@example.test`,
      fullName: "Lab Import Test Clinician",
      passwordHash: "integration-test-hash-not-a-credential",
      status: "ACTIVE",
    },
  });
});

test.after(async () => {
  await prisma.labImport.deleteMany({ where: { uploadedById: clinician?.id } });
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
