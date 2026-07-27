import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("private layout authenticates once and renders the shared shell", async () => {
  const source = await readSource("app/(private)/layout.js");

  assert.match(source, /requireCurrentClinician\(\)/);
  assert.match(source, /<AuthenticatedShell/);
  assert.equal(source.match(/requireCurrentClinician\(\)/g)?.length, 1);
});

test("authenticated root redirects to patients behind the private layout guard", async () => {
  const [pageSource, layoutSource] = await Promise.all([
    readSource("app/(private)/page.js"),
    readSource("app/(private)/layout.js"),
  ]);

  assert.match(pageSource, /import \{ redirect \} from "next\/navigation"/);
  assert.match(pageSource, /redirect\("\/patients"\)/);
  assert.doesNotMatch(pageSource, /PlaceholderPage|Clinical workspace/);
  assert.match(layoutSource, /requireCurrentClinician\(\)/);
});

test("public login page does not render the authenticated shell", async () => {
  const source = await readSource("app/(public)/login/page.js");

  assert.doesNotMatch(source, /AuthenticatedShell|AppNavigation/);
});

test("shell exposes an accessible skip link and stable main landmark", async () => {
  const source = await readSource("components/authenticated-shell.js");

  assert.match(source, /href="#main-content"/);
  assert.match(source, /id="main-content"/);
  assert.match(source, /tabIndex=\{-1\}/);
});

test("navigation uses semantic links, current-page state, and accessible Radix menus", async () => {
  const [source, dropdown] = await Promise.all([
    readSource("components/app-navigation.js"),
    readSource("components/custom-dropdown.js"),
  ]);

  assert.match(source, /<nav/);
  assert.match(source, /<Link/);
  assert.match(source, /aria-current=/);
  assert.match(source, /<CustomDropdown/);
  assert.match(dropdown, /DropdownMenu\.Trigger/);
  assert.match(dropdown, /DropdownMenu\.Content/);
  assert.match(source, /Dialog\.Trigger/);
  assert.match(source, /Dialog\.Close/);
  assert.match(source, /aria-label=\{messages\.openNavigation\}/);
  assert.match(source, /aria-label=\{messages\.closeNavigation\}/);
  assert.match(source, /onClick=\{onSelect\}/);
  assert.equal(source.match(/PRIMARY_NAVIGATION\.map/g)?.length, 2);
  assert.equal(source.match(/DASHBOARD_NAVIGATION\.map/g)?.length, 2);
});

test("dashboard and patient filters share a custom menu with distinct triggers", async () => {
  const [navigation, filters, dropdown, navigationStyles] = await Promise.all([
    readSource("components/app-navigation.js"),
    readSource("components/patient-filters.js"),
    readSource("components/custom-dropdown.js"),
    readSource("components/navigation-styles.js"),
  ]);

  assert.match(navigation, /variant="navigation"/);
  assert.match(navigation, /active=\{dashboardActive\}/);
  assert.match(navigationStyles, /navigationItemClass/);
  assert.match(dropdown, /navigationItemClass\(active\)/);
  assert.match(dropdown, /FILTER_CONTROL_CLASS/);
  assert.match(dropdown, /DropdownMenu\.RadioGroup/);
  assert.match(dropdown, /DropdownMenu\.RadioItem/);
  assert.match(filters, /<CustomDropdown/);
  assert.doesNotMatch(filters, /<select|<option/);
});

test("main application pages use eyebrow-free shared headers", async () => {
  const sources = await Promise.all([
    readSource("app/(private)/patients/page.js"),
    readSource("app/(private)/lab-uploads/page.js"),
    readSource("app/(private)/fhir-sync/page.js"),
    readSource("app/(private)/dashboard/clinic/page.js"),
    readSource("app/(private)/dashboard/patient/page.js"),
  ]);

  for (const source of sources) {
    assert.match(source, /<PageHeader/);
  }
  assert.doesNotMatch(sources[0], /\{messages\.brand\}/);
  assert.doesNotMatch(sources[1], /\{messages\.brand\}/);
  assert.doesNotMatch(sources[2], /\{messages\.clinicalIntegration\}/);
  assert.doesNotMatch(sources[3], /\{messages\.dashboard\}/);
  assert.doesNotMatch(sources[4], /\{messages\.dashboard\}/);
});

test("shell sends only safe clinician fields to visible identity UI", async () => {
  const source = await readSource("components/app-navigation.js");

  assert.match(source, /clinician\.fullName/);
  assert.match(source, /clinician\.email/);
  assert.doesNotMatch(
    source,
    /clinician\.(password|passwordHash|status|session|token)/,
  );
});

test("preference UI has accessible state and no client storage source", async () => {
  const [preferenceSource, navigationSource, rootLayoutSource] =
    await Promise.all([
      readSource("components/preference-controls.js"),
      readSource("components/app-navigation.js"),
      readSource("app/layout.js"),
    ]);
  const combined = `${preferenceSource}\n${navigationSource}\n${rootLayoutSource}`;

  assert.match(preferenceSource, /aria-pressed=/);
  assert.match(preferenceSource, /role="group"/);
  assert.match(preferenceSource, /window\.location\.reload\(\)/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage/);
  assert.doesNotMatch(combined, /tabIndex=\{[1-9]/);
});

test("header buttons share the restrained control radius", async () => {
  const [styles, globals, navigationSource, preferenceSource, logoutSource] =
    await Promise.all([
      readSource("components/control-styles.js"),
      readSource("app/globals.css"),
      readSource("components/app-navigation.js"),
      readSource("components/preference-controls.js"),
      readSource("components/logout-button.js"),
    ]);

  assert.match(styles, /CONTROL_RADIUS_CLASS = "control-pill rounded-full"/);
  assert.match(globals, /--radius-control: 9999px/);
  assert.match(globals, /input\[type="file"\]::file-selector-button/);
  assert.match(globals, /border-radius: var\(--radius-control\) !important;/);
  assert.match(
    globals,
    /button,\s*\.control-pill,[\s\S]*\[role="menuitem"\],[\s\S]*input\[type="submit"\]/,
  );
  assert.equal(
    navigationSource.match(/\$\{CONTROL_RADIUS_CLASS\}/g)?.length,
    2,
  );
  assert.equal(
    preferenceSource.match(/\$\{CONTROL_RADIUS_CLASS\}/g)?.length,
    2,
  );
  assert.match(logoutSource, /\$\{CONTROL_RADIUS_CLASS\} border/);
  assert.match(preferenceSource, /aria-pressed:bg-white/);
  assert.match(preferenceSource, /dark:aria-pressed:bg-slate-700/);
});

test("global interactive cursors distinguish enabled and disabled controls", async () => {
  const source = await readSource("app/globals.css");

  assert.match(source, /button:not\(:disabled\)/);
  assert.match(source, /a\[href\]:not\(\[aria-disabled="true"\]\)/);
  assert.match(source, /\[role="button"\]:not\(\[aria-disabled="true"\]\)/);
  assert.match(source, /\[role="tab"\]:not\(\[aria-disabled="true"\]\)/);
  assert.match(source, /cursor: pointer/);
  assert.match(source, /button:disabled/);
  assert.match(source, /\[aria-disabled="true"\]/);
  assert.match(source, /cursor: not-allowed/);
});

test("root layout applies server-resolved language, direction, and theme", async () => {
  const [source, preferences] = await Promise.all([
    readSource("app/layout.js"),
    readSource("server/preferences/current.js"),
  ]);

  assert.match(source, /getRequestPreferences\(\)/);
  assert.match(source, /lang=\{language\}/);
  assert.match(source, /dir=\{getDocumentDirection\(language\)\}/);
  assert.match(source, /className=\{theme === "dark"/);
  assert.doesNotMatch(source, /useEffect|window|localStorage/);
  assert.match(preferences, /cache\(async \(\) =>/);
  assert.match(preferences, /await cookies\(\)/);
});

test("preference endpoint remains behind clinician authentication", async () => {
  const source = await readSource("app/api/private/preferences/route.js");

  assert.match(source, /withClinicianAuthentication/);
  assert.match(source, /preferenceUpdateSchema\.safeParse/);
  assert.doesNotMatch(source, /AUTH_COOKIE_NAME|passwordHash/);
});
