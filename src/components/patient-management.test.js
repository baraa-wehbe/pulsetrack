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
  assert.match(source, /if \(onSuccess\)/);
  assert.match(source, /onSuccess\(body\.patient\)/);
  assert.match(source, /onCancel \?/);
  assert.doesNotMatch(source, /patient.*(password|login|session)/i);
});

test("new patient reuses the form in an accessible in-place modal", async () => {
  const [page, modal, dialogStyles, form, directRoute, patientDashboard] =
    await Promise.all([
      readSource("app/(private)/patients/page.js"),
      readSource("components/new-patient-modal.js"),
      readSource("components/dialog-styles.js"),
      readSource("components/patient-form.js"),
      readSource("app/(private)/patients/new/page.js"),
      readSource("app/(private)/dashboard/patient/page.js"),
    ]);

  assert.equal(page.match(/<NewPatientModal/g)?.length, 2);
  assert.doesNotMatch(page, /href="\/patients\/new"/);
  assert.match(modal, /Dialog\.Trigger asChild/);
  assert.match(modal, /Dialog\.Title/);
  assert.match(modal, /Dialog\.Description/);
  assert.match(modal, /Dialog\.Close asChild/);
  assert.match(modal, /aria-label=\{messages\.closePatientForm\}/);
  assert.match(modal, /DIALOG_CONTENT_CLASS/);
  assert.match(dialogStyles, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(dialogStyles, /overflow-y-auto/);
  assert.match(modal, /<PatientForm/);
  assert.match(modal, /onCancel=\{closeAndReset\}/);
  assert.match(modal, /onSuccess=\{handleSuccess\}/);
  assert.match(modal, /setFormKey\(\(current\) => current \+ 1\)/);
  assert.match(modal, /router\.refresh\(\)/);
  assert.doesNotMatch(modal, /router\.(push|replace)|window\.location/);
  assert.match(form, /setFieldErrors\(errors\)/);
  assert.match(form, /setFormError\(/);
  assert.match(directRoute, /redirect\("\/patients"\)/);
  assert.doesNotMatch(directRoute, /<PatientForm/);
  assert.doesNotMatch(patientDashboard, /href="\/patients\/new"/);
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

test("all dialog action footers share physical right alignment and primary-first order", async () => {
  const [styles, patientForm, assessmentForm, archiveDialog] =
    await Promise.all([
      readSource("components/dialog-styles.js"),
      readSource("components/patient-form.js"),
      readSource("components/patient-assessment-form.js"),
      readSource("components/archive-patient-button.js"),
    ]);

  assert.match(
    styles,
    /DIALOG_FOOTER_CLASS[\s\S]*justify-end[\s\S]*rtl:justify-start/,
  );
  for (const source of [patientForm, assessmentForm, archiveDialog]) {
    assert.match(source, /DIALOG_FOOTER_CLASS/);
  }
  assert.ok(
    patientForm.indexOf("messages.savePatient") <
      patientForm.indexOf("messages.cancel"),
  );
  assert.ok(
    assessmentForm.indexOf("messages.confirmSend") <
      assessmentForm.indexOf("messages.cancel"),
  );
  assert.ok(
    archiveDialog.indexOf("messages.confirmArchive") <
      archiveDialog.indexOf("messages.cancel"),
  );
});

test("patient list has responsive cards and a semantic table", async () => {
  const [source, filterSource] = await Promise.all([
    readSource("app/(private)/patients/page.js"),
    readSource("components/patient-filters.js"),
  ]);

  assert.match(source, /xl:hidden/);
  assert.match(source, /<table/);
  assert.match(source, /<caption/);
  assert.match(source, /scope="col"/);
  assert.match(source, /scope="row"/);
  assert.match(source, /PatientBadge/);
  assert.match(source, /Pagination/);
  assert.match(filterSource, /<form/);
  assert.match(filterSource, /name="search"/);
  assert.match(filterSource, /name=\{name\}/);
  assert.match(filterSource, /htmlFor="patient-search"/);
});

test("only MRN links to details and assessment actions open in-place dialogs", async () => {
  const source = await readSource("app/(private)/patients/page.js");

  assert.match(source, /buildPatientDetailHref\(patient\.id, listQuery\)/);
  assert.doesNotMatch(source, /href=\{`\/patients\/\$\{patient\.id\}`\}/);
  assert.match(source, /<MrnLink/);
  assert.doesNotMatch(source, /<h2[^>]*>\s*<Link/);
  assert.match(source, /<PatientAssessmentModal/);
  assert.match(source, /mode="IMMEDIATE"/);
  assert.match(source, /mode="SCHEDULED"/);
  assert.doesNotMatch(source, /\/send`|\/schedule`/);
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

test("patient filters navigate automatically with debounce and stale-request protection", async () => {
  const [pageSource, filterSource] = await Promise.all([
    readSource("app/(private)/patients/page.js"),
    readSource("components/patient-filters.js"),
  ]);

  assert.match(pageSource, /key=\{buildPatientListHref\(query\)\}/);
  assert.match(pageSource, /messages=\{messages\}/);
  assert.match(pageSource, /query=\{query\}/);
  assert.match(filterSource, /const SEARCH_DEBOUNCE_MS = 400/);
  assert.match(filterSource, /setTimeout\(\(\) =>/);
  assert.match(filterSource, /clearTimeout\(debounceRef\.current\)/);
  assert.match(filterSource, /router\.replace\(href, \{ scroll: false \}\)/);
  assert.match(filterSource, /\{ page: 1 \}/);
  assert.match(filterSource, /lastRequestedHrefRef/);
  assert.match(filterSource, /onChange=\{handleSearchChange\}/);
  assert.match(filterSource, /<CustomDropdown/);
  assert.match(filterSource, /onValueChange=/);
  assert.match(filterSource, /handleSelectChange\("pageSize", value\)/);
  assert.match(
    filterSource,
    /\[name\]: name === "pageSize" \? Number\(value\) : value/,
  );
  assert.doesNotMatch(filterSource, /<select|<option/);
  assert.match(filterSource, /value=\{filters\.search\}/);
  assert.match(filterSource, /href="\/patients"/);
  assert.match(filterSource, /onClick=\{handleClear\}/);
  assert.match(filterSource, /mt-4 flex justify-end rtl:justify-start/);
  assert.match(filterSource, /messages\.clearPatientFiltersAction/);
  assert.doesNotMatch(filterSource, /\{messages\.clearFilters\}/);
  assert.doesNotMatch(filterSource, /applyFilters|type="submit"/);
});

test("patient list actions use the shared pill control radius", async () => {
  const [styles, page, filters, modal, form, error] = await Promise.all([
    readSource("components/control-styles.js"),
    readSource("app/(private)/patients/page.js"),
    readSource("components/patient-filters.js"),
    readSource("components/new-patient-modal.js"),
    readSource("components/patient-form.js"),
    readSource("app/(private)/patients/error.js"),
  ]);

  assert.match(styles, /CONTROL_RADIUS_CLASS = "control-pill rounded-full"/);
  for (const source of [page, filters, modal, error]) {
    assert.match(source, /CONTROL_RADIUS_CLASS/);
  }
  assert.match(page, /newPatientButtonClass[\s\S]*CONTROL_RADIUS_CLASS/);
  assert.equal(page.match(/\$\{CONTROL_RADIUS_CLASS\}/g)?.length, 8);
  assert.match(modal, /controlRadiusClass=\{CONTROL_RADIUS_CLASS\}/);
  assert.match(form, /controlRadiusClass = "rounded-full"/);
  assert.equal(form.match(/\$\{controlRadiusClass\}/g)?.length, 3);
});

test("all status badge renderers use the shared pill radius", async () => {
  const [styles, ...badgeSources] = await Promise.all([
    readSource("components/badge-styles.js"),
    readSource("components/patient-badge.js"),
    readSource("components/assessment-badge.js"),
    readSource("app/(private)/fhir-sync/page.js"),
    readSource("app/(private)/lab-uploads/page.js"),
    readSource("app/(private)/lab-uploads/[importId]/page.js"),
    readSource("app/(private)/dashboard/clinic/page.js"),
    readSource("app/(private)/dashboard/patient/page.js"),
  ]);

  assert.match(styles, /STATUS_BADGE_RADIUS_CLASS = "rounded-full"/);
  for (const source of badgeSources) {
    assert.match(source, /STATUS_BADGE_RADIUS_CLASS/);
    assert.doesNotMatch(source, /rounded-(?:none|sm|md)\b/);
  }
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
  assert.match(translations, /clearPatientFiltersAction: "Clear"/);
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
