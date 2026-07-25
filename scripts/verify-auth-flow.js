import "dotenv/config";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env.mjs";
import { normalizeClinicianEmail } from "@/lib/clinician-email";
import { hashPassword } from "@/server/auth/password";

const BASE_URL = "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
const suffix = randomBytes(8).toString("hex");
const email = normalizeClinicianEmail(`manual-${suffix}@example.test`);
const password = randomBytes(24).toString("base64url");
let clinicianId;

const request = (path, options = {}) =>
  fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...options,
  });

const login = (loginEmail, loginPassword) =>
  request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: loginEmail,
      password: loginPassword,
    }),
  });

const main = async () => {
  try {
    const clinician = await prisma.clinician.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        fullName: "Manual Authentication Verification",
      },
    });
    clinicianId = clinician.id;

    const publicLogin = await request("/login");
    assert.equal(publicLogin.status, 200);

    const anonymousPage = await request("/");
    assert.ok([303, 307, 308].includes(anonymousPage.status));
    assert.equal(
      new URL(anonymousPage.headers.get("location"), BASE_URL).pathname,
      "/login",
    );

    const anonymousApi = await request("/api/private/session");
    assert.equal(anonymousApi.status, 401);
    assert.deepEqual(await anonymousApi.json(), { error: "Unauthorized." });

    const incorrect = await login(email, "incorrect");
    const unknown = await login("unknown@example.test", "incorrect");
    assert.equal(incorrect.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await incorrect.json(), {
      error: "Invalid email or password.",
    });
    assert.deepEqual(await unknown.json(), {
      error: "Invalid email or password.",
    });
    assert.equal(incorrect.headers.get("set-cookie"), null);
    assert.equal(unknown.headers.get("set-cookie"), null);

    const invalid = await login("not-an-email", "");
    assert.equal(invalid.status, 400);

    const authenticated = await login(`  ${email.toUpperCase()}  `, password);
    assert.equal(authenticated.status, 200);
    const authenticatedBody = await authenticated.json();
    assert.equal("passwordHash" in authenticatedBody.clinician, false);
    assert.equal(JSON.stringify(authenticatedBody).includes(password), false);

    const setCookie = authenticated.headers.get("set-cookie");
    assert.ok(setCookie);
    assert.match(setCookie, /pulsetrack_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);
    const cookie = setCookie.split(";")[0];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const privatePage = await request("/", {
        headers: { Cookie: cookie },
      });
      assert.equal(privatePage.status, 200);
      assert.match(await privatePage.text(), /Welcome/);
    }

    const privateApi = await request("/api/private/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(privateApi.status, 200);
    assert.equal((await privateApi.json()).clinician.id, clinician.id);

    const authenticatedLoginPage = await request("/login", {
      headers: { Cookie: cookie },
    });
    assert.ok([303, 307, 308].includes(authenticatedLoginPage.status));
    assert.equal(
      new URL(authenticatedLoginPage.headers.get("location"), BASE_URL)
        .pathname,
      "/",
    );

    await prisma.clinician.update({
      where: { id: clinician.id },
      data: { status: "DISABLED" },
    });

    const disabledLogin = await login(email, password);
    assert.equal(disabledLogin.status, 401);
    assert.deepEqual(await disabledLogin.json(), {
      error: "Invalid email or password.",
    });
    const disabledSession = await request("/api/private/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(disabledSession.status, 401);
    const disabledPage = await request("/", {
      headers: { Cookie: cookie },
    });
    assert.ok([303, 307, 308].includes(disabledPage.status));
    assert.equal(
      new URL(disabledPage.headers.get("location"), BASE_URL).pathname,
      "/login",
    );

    await prisma.clinician.update({
      where: { id: clinician.id },
      data: { status: "ACTIVE" },
    });
    const revokedAfterDisable = await request("/api/private/session", {
      headers: { Cookie: cookie },
    });
    assert.equal(revokedAfterDisable.status, 401);

    const secondLogin = await login(email, password);
    const secondCookie = secondLogin.headers.get("set-cookie").split(";")[0];
    const logout = await request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: secondCookie },
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);

    const afterLogout = await request("/api/private/session", {
      headers: { Cookie: secondCookie },
    });
    assert.equal(afterLogout.status, 401);
    const pageAfterLogout = await request("/", {
      headers: { Cookie: secondCookie },
    });
    assert.ok([303, 307, 308].includes(pageAfterLogout.status));
    assert.equal(
      (
        await request("/api/auth/logout", {
          method: "POST",
          headers: { Cookie: secondCookie },
        })
      ).status,
      204,
    );

    console.log(
      "Authentication HTTP verification passed without exposing credentials.",
    );
  } finally {
    if (clinicianId) {
      await prisma.clinician.delete({ where: { id: clinicianId } });
    }

    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
