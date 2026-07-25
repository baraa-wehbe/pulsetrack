import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LANGUAGE,
  DEFAULT_THEME,
  getDocumentDirection,
  LANGUAGE_VALUES,
  PREFERENCE_COOKIE_NAMES,
  PREFERENCE_COOKIE_OPTIONS,
  resolvePreferences,
  THEME_VALUES,
} from "@/config/preferences";
import { getTranslations } from "@/i18n/translations";
import {
  DASHBOARD_NAVIGATION,
  isDashboardRoute,
  isRouteActive,
  PRIMARY_NAVIGATION,
} from "@/lib/navigation";
import { preferenceUpdateSchema } from "@/server/preferences/validation";

const cookieStore = (values = {}) => ({
  get: (name) =>
    Object.hasOwn(values, name) ? { value: values[name] } : undefined,
});

test("missing preference cookies use fixed English and light defaults", () => {
  assert.deepEqual(resolvePreferences(cookieStore()), {
    language: DEFAULT_LANGUAGE,
    theme: DEFAULT_THEME,
  });
  assert.equal(DEFAULT_LANGUAGE, "en");
  assert.equal(DEFAULT_THEME, "light");
});

test("valid preference cookies override defaults", () => {
  assert.deepEqual(
    resolvePreferences(
      cookieStore({
        [PREFERENCE_COOKIE_NAMES.language]: "ar",
        [PREFERENCE_COOKIE_NAMES.theme]: "dark",
      }),
    ),
    { language: "ar", theme: "dark" },
  );
});

test("invalid preference cookies safely fall back to fixed defaults", () => {
  assert.deepEqual(
    resolvePreferences(
      cookieStore({
        [PREFERENCE_COOKIE_NAMES.language]: "fr",
        [PREFERENCE_COOKIE_NAMES.theme]: "system",
      }),
    ),
    { language: "en", theme: "light" },
  );
});

test("language and theme values use strict allowlists and safe cookies", () => {
  assert.deepEqual(LANGUAGE_VALUES, ["en", "ar"]);
  assert.deepEqual(THEME_VALUES, ["light", "dark"]);
  assert.equal(PREFERENCE_COOKIE_NAMES.language, "pulsetrack_language");
  assert.equal(PREFERENCE_COOKIE_NAMES.theme, "pulsetrack_theme");
  assert.equal(PREFERENCE_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(PREFERENCE_COOKIE_OPTIONS.path, "/");
  assert.equal(PREFERENCE_COOKIE_OPTIONS.sameSite, "lax");
  assert.ok(PREFERENCE_COOKIE_OPTIONS.maxAge > 0);

  assert.equal(
    preferenceUpdateSchema.safeParse({ kind: "language", value: "ar" }).success,
    true,
  );
  assert.equal(
    preferenceUpdateSchema.safeParse({ kind: "theme", value: "dark" }).success,
    true,
  );

  for (const invalid of [
    { kind: "language", value: "fr" },
    { kind: "theme", value: "system" },
    { kind: "arbitrary", value: "dark" },
    { kind: "theme", value: "dark", cookieName: "session" },
  ]) {
    assert.equal(preferenceUpdateSchema.safeParse(invalid).success, false);
  }
});

test("English and Arabic translations and directions are deterministic", () => {
  assert.equal(getDocumentDirection("en"), "ltr");
  assert.equal(getDocumentDirection("ar"), "rtl");
  assert.equal(getTranslations("en").patients, "Patients");
  assert.equal(getTranslations("ar").patients, "المرضى");
  assert.equal(getTranslations("ar").clinicDashboard, "لوحة متابعة العيادة");
  assert.equal(getTranslations("invalid").patients, "Patients");
});

test("navigation exposes required distinct protected destinations", () => {
  assert.deepEqual(PRIMARY_NAVIGATION, [
    { href: "/patients", labelKey: "patients" },
    { href: "/lab-uploads", labelKey: "labUploads" },
  ]);
  assert.deepEqual(DASHBOARD_NAVIGATION, [
    { href: "/dashboard/clinic", labelKey: "clinicDashboard" },
    { href: "/dashboard/patient", labelKey: "patientDashboard" },
  ]);
});

test("active route matching respects path segment boundaries", () => {
  assert.equal(isRouteActive("/patients", "/patients"), true);
  assert.equal(isRouteActive("/patients/example", "/patients"), true);
  assert.equal(isRouteActive("/patients-archive", "/patients"), false);
  assert.equal(isRouteActive("/dashboard/patient", "/dashboard/clinic"), false);
  assert.equal(isDashboardRoute("/dashboard/patient"), true);
  assert.equal(isDashboardRoute("/patients"), false);
});
