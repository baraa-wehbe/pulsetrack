import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("patient list performs active-only server filtering with stable ordering", async () => {
  const source = await readSource("server/patients/service.js");

  assert.match(source, /filters = \[\{ archivedAt: null \}\]/);
  assert.match(source, /mode: "insensitive"/);
  assert.match(source, /fhirOwnership/);
  assert.match(source, /fhirSyncStatus/);
  assert.match(source, /skip:/);
  assert.match(source, /take: query\.pageSize/);
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

  assert.match(source, /xl:hidden/);
  assert.match(source, /<table/);
  assert.match(source, /<caption/);
  assert.match(source, /scope="col"/);
  assert.match(source, /scope="row"/);
  assert.match(source, /PatientBadge/);
  assert.match(source, /Pagination/);
  assert.match(source, /method="get"/);
  assert.match(source, /name="search"/);
  assert.match(source, /name=\{name\}/);
});

test("only MRN links to patient details and assessment actions have protected destinations", async () => {
  const source = await readSource("app/(private)/patients/page.js");

  assert.match(source, /buildPatientDetailHref\(patient\.mrn, listQuery\)/);
  assert.doesNotMatch(source, /href=\{`\/patients\/\$\{patient\.id\}`\}/);
  assert.match(source, /<MrnLink/);
  assert.doesNotMatch(source, /<h2[^>]*>\s*<Link/);
  assert.match(source, /\/send`/);
  assert.match(source, /\/schedule`/);
  assert.match(source, /sendQuestionnaireTo/);
  assert.match(source, /scheduleQuestionnaireFor/);
});

test("patient list loading, empty, filtered-empty, and error states are intentional", async () => {
  const [page, loading, error] = await Promise.all([
    readSource("app/(private)/patients/page.js"),
    readSource("app/(private)/patients/loading.js"),
    readSource("app/(private)/patients/error.js"),
  ]);

  assert.match(page, /noMatchingPatientsTitle/);
  assert.match(page, /noPatientsTitle/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-hidden="true"/);
  assert.match(error, /role="alert"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.doesNotMatch(error, /error\.message/);
});

test("FHIR badge mappings and list labels are centralized in English and Arabic", async () => {
  const [mappings, translations] = await Promise.all([
    readSource("lib/patient-list.js"),
    readSource("i18n/translations.js"),
  ]);

  for (const value of [
    "LOCAL",
    "FHIR",
    "NONE",
    "CANDIDATE_OWNED",
    "EXTERNAL_READ_ONLY",
    "NOT_SYNCED",
    "PENDING",
    "SYNCED",
    "FAILED",
  ]) {
    assert.match(mappings, new RegExp(`${value}:`));
  }
  assert.match(translations, /searchPatients: "Search patients"/);
  assert.match(translations, /searchPatients: "البحث عن المرضى"/);
  assert.match(translations, /noMatchingPatientsTitle:/);
  assert.match(translations, /sendAssessmentDescription:/);
  assert.match(translations, /scheduleAssessmentDescription:/);
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
    readSource("components/patient-assessment-form.js"),
    readSource("app/(private)/patients/page.js"),
    readSource("app/(private)/patients/[patientId]/page.js"),
    readSource("app/(private)/patients/[patientId]/send/page.js"),
    readSource("app/(private)/patients/[patientId]/schedule/page.js"),
  ]);
  const source = files.join("\n");

  assert.doesNotMatch(
    source,
    /patient.{0,30}(password|login|logout|session|account)/i,
  );
  assert.doesNotMatch(source, /tabIndex=\{[1-9]/);
});
