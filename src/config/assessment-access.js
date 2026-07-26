export const ASSESSMENT_ACCESS_COOKIE_NAME = "pulsetrack_assessment_access";

export const ASSESSMENT_ACCESS_DURATION_SECONDS = 60 * 60;

export const ASSESSMENT_ACCESS_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  maxAge: ASSESSMENT_ACCESS_DURATION_SECONDS,
  path: "/assessment",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
});
