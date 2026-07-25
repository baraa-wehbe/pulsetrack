import { createHash, randomBytes } from "node:crypto";

import { AUTH_SESSION_DURATION_MS } from "@/config/auth";
import { toPublicClinician } from "@/server/auth/clinician";

const SESSION_TOKEN_BYTES = 32;
const SESSION_TOKEN_LENGTH = 43;

const sessionClinicianSelect = {
  id: true,
  email: true,
  fullName: true,
  status: true,
  preferredLocale: true,
  themePreference: true,
};

export const hashSessionToken = (token) =>
  createHash("sha256").update(token).digest("hex");

export const isValidSessionToken = (token) =>
  typeof token === "string" &&
  token.length === SESSION_TOKEN_LENGTH &&
  /^[A-Za-z0-9_-]+$/.test(token);

export const createClinicianSession = async (
  prismaClient,
  clinicianId,
  now = new Date(),
) => {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(now.getTime() + AUTH_SESSION_DURATION_MS);

  await prismaClient.$transaction([
    prismaClient.clinician.update({
      where: { id: clinicianId },
      data: { lastLoginAt: now },
    }),
    prismaClient.clinicianSession.create({
      data: {
        clinicianId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
};

export const resolveClinicianSession = async (
  prismaClient,
  token,
  now = new Date(),
) => {
  if (!isValidSessionToken(token)) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await prismaClient.clinicianSession.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      revokedAt: true,
      clinician: {
        select: sessionClinicianSelect,
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= now) {
    return null;
  }

  if (session.clinician.status !== "ACTIVE") {
    await prismaClient.clinicianSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });

    return null;
  }

  return toPublicClinician(session.clinician);
};

export const revokeClinicianSession = async (
  prismaClient,
  token,
  now = new Date(),
) => {
  if (!isValidSessionToken(token)) {
    return;
  }

  await prismaClient.clinicianSession.updateMany({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
    },
    data: { revokedAt: now },
  });
};
