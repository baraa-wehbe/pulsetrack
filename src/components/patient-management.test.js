import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("patient list performs an active-only server query with stable ordering", async () => {
  const source = await readSource("server/patients/service.js");

  assert.match(source, /where: \{ archivedAt: null \}/);
  assert.match(source, /\{ lastName: "asc" \}/);
  assert.match(source, /\{ firstName: "asc" \}/);
  assert.match(source, /\{ mrn: "asc" \}/);
  assert.match(source, /\{ id: "asc" \}/);
});

test("patient mutation APIs are protected and expose expected methods", async () => {
  const [collection, item, archive] = await Promise.all([
    readSource("app/api/private/patients/route.js"),
    readSource("app/api/private/patients/[patientId]/route.js"),
    readSource("app/api/private/patients/[patientId]/archive/route.js"),
  ]);

  assert.match(collection, /export const GET = withClinicianAuthentication/);
  assert.match(collection, /export const POST = withClinicianAuthentication/);
  assert.match(item, /export const GET = withClinicianAuthentication/);
  assert.match(item, /export const PATCH = withClinicianAuthentication/);
  assert.match(archive, /export const POST = withClinicianAuthentication/);
});

test("patient form exposes labels, field errors, and shared normalization", async () => {
  const source = await readSource("components/patient-form.js");

  for (const field of [
    "mrn",
    "firstName",
    "lastName",
    "dateOfBirth",
    "sex",
    "email",
    "phone",
  ]) {
    assert.match(source, new RegExp(`htmlFor="${field}"`));
    assert.match(source, new RegExp(`id="${field}"`));
  }

  assert.match(source, /aria-invalid=/);
  assert.match(source, /aria-describedby=/);
  assert.match(source, /normalizePatientMrn/);
  assert.match(source, /normalizePatientEmail/);
  assert.match(source, /focusFirstError/);
  assert.doesNotMatch(source, /patient.*(password|login|session)/i);
});

test("archive confirmation uses an accessible dialog and soft-delete endpoint", async () => {
  const source = await readSource("components/archive-patient-button.js");

  assert.match(source, /Dialog\.Title/);
  assert.match(source, /Dialog\.Description/);
  assert.match(source, /Dialog\.Close/);
  assert.match(source, /\/archive/);
  assert.match(source, /method: "POST"/);
  assert.doesNotMatch(source, /method: "DELETE"/);
});

test("patient list has responsive cards and a semantic table", async () => {
  const source = await readSource("app/(private)/patients/page.js");

  assert.match(source, /md:hidden/);
  assert.match(source, /<table/);
  assert.match(source, /<caption/);
  assert.match(source, /scope="col"/);
  assert.match(source, /scope="row"/);
});

test("English and Arabic patient UI translations are centralized", async () => {
  const source = await readSource("i18n/translations.js");

  assert.match(source, /newPatient: "New patient"/);
  assert.match(source, /newPatient: "مريض جديد"/);
  assert.match(source, /validationMrnConflict:/);
  assert.match(source, /archivePatientTitle:/);
});

test("no patient authentication UI or positive tab index is introduced", async () => {
  const files = await Promise.all([
    readSource("components/patient-form.js"),
    readSource("components/archive-patient-button.js"),
    readSource("app/(private)/patients/page.js"),
    readSource("app/(private)/patients/[patientId]/page.js"),
  ]);
  const source = files.join("\n");

  assert.doesNotMatch(
    source,
    /patient.{0,30}(password|login|logout|session|account)/i,
  );
  assert.doesNotMatch(source, /tabIndex=\{[1-9]/);
});
