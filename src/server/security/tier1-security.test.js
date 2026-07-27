import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../", import.meta.url));
const readSource = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(location)));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(location);
  }
  return files;
};

test("every private API uses centralized clinician authentication", async () => {
  const privateApiRoot = fileURLToPath(
    new URL("../../app/api/private/", import.meta.url),
  );
  const routes = (await walk(privateApiRoot)).filter((file) =>
    file.endsWith("route.js"),
  );
  assert.ok(routes.length > 0);

  for (const route of routes) {
    const source = await readFile(route, "utf8");
    assert.match(
      source,
      /withClinicianAuthentication|export \{ GET, POST \} from "@\/server\/labs\/http"/,
      `${route} must use centralized authentication`,
    );
  }
});

test("private pages remain beneath the authenticated server layout", async () => {
  const layout = await readSource("app/(private)/layout.js");
  assert.match(layout, /requireCurrentClinician/);
  assert.match(layout, /AuthenticatedShell/);
});

test("patient navigation uses opaque identifiers and never embeds MRNs in URLs", async () => {
  const files = [
    "app/(private)/patients/page.js",
    "app/(private)/patients/[patientId]/page.js",
    "components/patient-form.js",
    "components/patient-assessment-form.js",
    "app/(private)/dashboard/patient/page.js",
    "lib/patient-list.js",
  ];
  const combined = (
    await Promise.all(files.map((file) => readSource(file)))
  ).join("\n");

  assert.doesNotMatch(combined, /encodeURIComponent\(patient\.mrn\)/);
  assert.doesNotMatch(combined, /buildPatientDetailHref\(patient\.mrn/);
  assert.match(combined, /buildPatientDetailHref\(patient\.id/);
  assert.match(combined, /name="patient"/);
  assert.match(combined, /value=\{patient\.id\}/);
});

test("public assessment UI and responses expose no patient identity or token", async () => {
  const [page, form, submit, exchange] = await Promise.all([
    readSource("app/(public)/assessment/page.js"),
    readSource("components/public-assessment-form.js"),
    readSource("app/(public)/assessment/submit/route.js"),
    readSource("app/(public)/assessment/[token]/route.js"),
  ]);
  for (const source of [page, form, submit]) {
    assert.doesNotMatch(
      source,
      /patient\.(?:id|mrn|email|firstName|lastName)|recipientEmail|tokenHash/,
    );
  }
  assert.match(exchange, /redirect/);
  assert.doesNotMatch(exchange, /Response\.json[\s\S]*token/);
});

test("operational logs use controlled messages and error names only", async () => {
  const files = await walk(sourceRoot);
  for (const file of files.filter(
    (candidate) =>
      !candidate.includes(`${path.sep}generated${path.sep}`) &&
      !candidate.endsWith(".test.js"),
  )) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /console\.error\(\s*error\s*\)/,
      `${file} logs a raw error`,
    );
    assert.doesNotMatch(
      source,
      /console\.(?:log|error)\([^)]*(?:rawToken|recipientEmail|password|answers|mrn|labResult)/s,
      `${file} may log sensitive domain data`,
    );
  }
});

test("patient audit and lab import persistence avoid unnecessary PHI copies", async () => {
  const [patients, labs] = await Promise.all([
    readSource("server/patients/service.js"),
    readSource("server/labs/processing.js"),
  ]);

  assert.doesNotMatch(
    patients,
    /metadata:\s*\{\s*changedFields,\s*changes\s*\}/,
  );
  assert.match(patients, /metadata:\s*\{\s*changedFields\s*\}/);
  assert.match(labs, /rawData:\s*\{\}/);
  assert.doesNotMatch(labs, /rawData:\s*row\.fields/);
});
