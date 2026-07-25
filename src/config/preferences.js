export const LANGUAGE_VALUES = Object.freeze(["en", "ar"]);
export const THEME_VALUES = Object.freeze(["light", "dark"]);

export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_THEME = "light";

export const PREFERENCE_COOKIE_NAMES = Object.freeze({
  language: "pulsetrack_language",
  theme: "pulsetrack_theme",
});

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export const PREFERENCE_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  maxAge: ONE_YEAR_IN_SECONDS,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});

export const resolveAllowedPreference = (value, allowedValues, fallback) =>
  allowedValues.includes(value) ? value : fallback;

export const resolvePreferences = (cookieStore) => ({
  language: resolveAllowedPreference(
    cookieStore.get(PREFERENCE_COOKIE_NAMES.language)?.value,
    LANGUAGE_VALUES,
    DEFAULT_LANGUAGE,
  ),
  theme: resolveAllowedPreference(
    cookieStore.get(PREFERENCE_COOKIE_NAMES.theme)?.value,
    THEME_VALUES,
    DEFAULT_THEME,
  ),
});

export const getDocumentDirection = (language) =>
  language === "ar" ? "rtl" : "ltr";
