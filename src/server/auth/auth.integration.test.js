import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env.mjs";
import { normalizeClinicianEmail } from "@/lib/clinician-email";
import { authenticateClinicianCredentials } from "@/server/auth/credentials";
import { hashPassword } from "@/server/auth/password";
import {
  createClinicianSession,
  resolveClinicianSession,
  revokeClinicianSession,
} from "@/server/auth/session";

test("clinician credentials and sessions enforce database integrity", async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  const suffix = randomBytes(8).toString("hex");
  const email = normalizeClinicianEmail(`Auth-${suffix}@Example.Test`);
  const password = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);
  let clinicianId;

  try {
    const clinician = await prisma.clinician.create({
      data: {
        email,
        passwordHash,
        fullName: "Authentication Integration Clinician",
      },
    });
    clinicianId = clinician.id;

    assert.notEqual(clinician.passwordHash, password);
    assert.equal(clinician.email, email.toLowerCase());

    await assert.rejects(
      prisma.clinician.create({
        data: {
          email: email.toUpperCase(),
          passwordHash,
          fullName: "Duplicate Authentication Clinician",
        },
      }),
    );

    const authenticated = await authenticateClinicianCredentials(prisma, {
      email: `  ${email.toUpperCase()}  `,
      password,
    });
    assert.equal(authenticated.ok, true);
    assert.equal("passwordHash" in authenticated.clinician, false);

    const session = await createClinicianSession(prisma, clinician.id);
    assert.equal(
      (await resolveClinicianSession(prisma, session.token)).id,
      clinician.id,
    );

    await prisma.clinician.update({
      where: { id: clinician.id },
      data: { status: "DISABLED" },
    });
    assert.equal(
      (
        await authenticateClinicianCredentials(prisma, {
          email,
          password,
        })
      ).kind,
      "authentication",
    );
    assert.equal(await resolveClinicianSession(prisma, session.token), null);

    await prisma.clinician.update({
      where: { id: clinician.id },
      data: { status: "ACTIVE" },
    });
    await revokeClinicianSession(prisma, session.token);
    assert.equal(await resolveClinicianSession(prisma, session.token), null);
  } finally {
    if (clinicianId) {
      await prisma.clinician.delete({ where: { id: clinicianId } });
    }

    await prisma.$disconnect();
  }
});
