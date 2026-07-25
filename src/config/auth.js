import { env } from "@/config/env.mjs";

export const AUTH_COOKIE_NAME = "pulsetrack_session";
export const AUTH_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export const getAuthCookieOptions = (
  expires,
  nodeEnvironment = env.NODE_ENV,
) => ({
  httpOnly: true,
  secure: nodeEnvironment === "production",
  sameSite: "lax",
  path: "/",
  expires,
});

export const setAuthCookie = (cookieStore, token, expiresAt) => {
  cookieStore.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions(expiresAt));
};

export const clearAuthCookie = (cookieStore) => {
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    ...getAuthCookieOptions(new Date(0)),
    maxAge: 0,
  });
};
