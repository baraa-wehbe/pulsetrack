import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value) => createHash("sha256").update(value).digest();

export const isSchedulerAuthorized = (authorization, configuredSecret) => {
  if (
    typeof configuredSecret !== "string" ||
    configuredSecret.length < 32 ||
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return false;
  }

  const candidate = authorization.slice("Bearer ".length);
  if (!candidate || candidate.length > 4096) {
    return false;
  }

  return timingSafeEqual(digest(candidate), digest(configuredSecret));
};
