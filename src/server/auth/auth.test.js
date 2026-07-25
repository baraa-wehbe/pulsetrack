import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  getAuthCookieOptions,
  setAuthCookie,
} from "@/config/auth";
import { normalizeClinicianEmail } from "@/lib/clinician-email";
import { authenticateClinicianCredentials } from "@/server/auth/credentials";
import {
  createLoginHandler,
  createLogoutHandler,
} from "@/server/auth/handlers";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  createClinicianSession,
  resolveClinicianSession,
  revokeClinicianSession,
} from "@/server/auth/session";
import { loginInputSchema, safeReturnPath } from "@/server/auth/validation";

const createClinician = async (overrides = {}) => ({
  id: "clinician-1",
  email: "clinician@example.test",
  passwordHash: await hashPassword("correct-password"),
  fullName: "Test Clinician",
  status: "ACTIVE",
  preferredLocale: "EN",
  themePreference: "SYSTEM",
  ...overrides,
});

const createAuthPrisma = (clinician) => ({
  clinician: {
    findUnique: async ({ where }) =>
      where.email === clinician?.email ? clinician : null,
  },
});

const createSessionPrisma = (clinician) => {
  const state = { clinician, sessions: [] };

  return {
    state,
    clinician: {
      findUnique: async ({ where }) =>
        where.email === state.clinician?.email ? state.clinician : null,
      update: async ({ data }) => {
        state.clinician = { ...state.clinician, ...data };
        return state.clinician;
      },
    },
    clinicianSession: {
      create: async ({ data }) => {
        const session = {
          ...data,
          revokedAt: null,
          clinician: state.clinician,
        };
        state.sessions.push(session);
        return session;
      },
      findUnique: async ({ where }) => {
        const session = state.sessions.find(
          ({ tokenHash }) => tokenHash === where.tokenHash,
        );

        return session ? { ...session, clinician: state.clinician } : null;
      },
      updateMany: async ({ where, data }) => {
        let count = 0;

        for (const session of state.sessions) {
          if (
            session.tokenHash === where.tokenHash &&
            session.revokedAt === where.revokedAt
          ) {
            Object.assign(session, data);
            count += 1;
          }
        }

        return { count };
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
};

test("Argon2id hashes and verifies passwords securely", async () => {
  const password = "a test password that is not a credential";
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, password);
  assert.match(firstHash, /^\$argon2id\$/);
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(firstHash, password), true);
  assert.equal(await verifyPassword(firstHash, "incorrect"), false);
});

test("clinician email normalization trims and lowercases", () => {
  assert.equal(
    normalizeClinicianEmail("  Clinician@Example.TEST "),
    "clinician@example.test",
  );
  assert.equal(
    loginInputSchema.parse({
      email: "  Clinician@Example.TEST ",
      password: "password",
    }).email,
    "clinician@example.test",
  );
});

test("credentials authenticate safely and return no password hash", async () => {
  const clinician = await createClinician();
  const prismaClient = createAuthPrisma(clinician);
  const result = await authenticateClinicianCredentials(prismaClient, {
    email: "  CLINICIAN@EXAMPLE.TEST ",
    password: "correct-password",
  });

  assert.equal(result.ok, true);
  assert.equal(result.clinician.email, "clinician@example.test");
  assert.equal("passwordHash" in result.clinician, false);
});

test("wrong, unknown, and disabled credentials share one failure kind", async () => {
  const clinician = await createClinician();
  const wrongPassword = await authenticateClinicianCredentials(
    createAuthPrisma(clinician),
    {
      email: clinician.email,
      password: "incorrect",
    },
  );
  const unknownEmail = await authenticateClinicianCredentials(
    createAuthPrisma(clinician),
    {
      email: "unknown@example.test",
      password: "incorrect",
    },
  );
  const disabled = await authenticateClinicianCredentials(
    createAuthPrisma({ ...clinician, status: "DISABLED" }),
    {
      email: clinician.email,
      password: "correct-password",
    },
  );

  assert.deepEqual(wrongPassword, {
    ok: false,
    kind: "authentication",
  });
  assert.deepEqual(unknownEmail, wrongPassword);
  assert.deepEqual(disabled, wrongPassword);
});

test("invalid login input and unsafe return paths are rejected", async () => {
  const clinician = await createClinician();
  const result = await authenticateClinicianCredentials(
    createAuthPrisma(clinician),
    {
      email: "not-an-email",
      password: "",
    },
  );

  assert.deepEqual(result, { ok: false, kind: "validation" });
  assert.equal(safeReturnPath("https://example.test"), "/");
  assert.equal(safeReturnPath("//example.test"), "/");
  assert.equal(safeReturnPath("/login?next=/"), "/");
  assert.equal(safeReturnPath("/patients"), "/patients");
});

test("authentication cookies are HttpOnly and clear with matching scope", () => {
  const writes = [];
  const cookieStore = {
    set: (...parameters) => writes.push(parameters),
  };
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");

  setAuthCookie(cookieStore, "opaque-token", expiresAt);
  clearAuthCookie(cookieStore);

  assert.equal(writes[0][0], AUTH_COOKIE_NAME);
  assert.equal(writes[0][1], "opaque-token");
  assert.deepEqual(writes[0][2], {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  assert.equal(writes[1][0], AUTH_COOKIE_NAME);
  assert.equal(writes[1][1], "");
  assert.equal(writes[1][2].path, writes[0][2].path);
  assert.equal(writes[1][2].maxAge, 0);
  assert.equal(getAuthCookieOptions(expiresAt, "production").secure, true);
});

test("sessions reject malformed, expired, revoked, and disabled access", async () => {
  const clinician = await createClinician();
  const prismaClient = createSessionPrisma(clinician);
  const now = new Date("2030-01-01T00:00:00.000Z");
  const session = await createClinicianSession(prismaClient, clinician.id, now);

  assert.equal(
    (
      await resolveClinicianSession(
        prismaClient,
        session.token,
        new Date("2030-01-01T01:00:00.000Z"),
      )
    ).id,
    clinician.id,
  );
  assert.equal(
    await resolveClinicianSession(prismaClient, "malformed", now),
    null,
  );
  assert.equal(
    await resolveClinicianSession(
      prismaClient,
      session.token,
      new Date("2030-01-02T00:00:00.000Z"),
    ),
    null,
  );

  prismaClient.state.clinician.status = "DISABLED";
  assert.equal(
    await resolveClinicianSession(prismaClient, session.token, now),
    null,
  );

  prismaClient.state.clinician.status = "ACTIVE";
  await revokeClinicianSession(prismaClient, session.token, now);
  assert.equal(
    await resolveClinicianSession(prismaClient, session.token, now),
    null,
  );
  await revokeClinicianSession(prismaClient, session.token, now);
});

test("login and logout handlers issue, revoke, and clear secure sessions", async () => {
  const clinician = await createClinician();
  const prismaClient = createSessionPrisma(clinician);
  const writes = [];
  const cookieStore = {
    set: (...parameters) => writes.push(parameters),
  };
  const dependencies = {
    prismaClient,
    getCookieStore: async () => cookieStore,
    onInternalError: () => assert.fail("Unexpected internal error"),
  };
  const login = createLoginHandler(dependencies);
  const validResponse = await login(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: clinician.email,
        password: "correct-password",
      }),
    }),
  );
  const validBody = await validResponse.json();

  assert.equal(validResponse.status, 200);
  assert.equal("passwordHash" in validBody.clinician, false);
  assert.equal(JSON.stringify(validBody).includes("correct-password"), false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], AUTH_COOKIE_NAME);
  assert.equal(writes[0][2].httpOnly, true);

  const token = writes[0][1];
  assert.equal(
    (await resolveClinicianSession(prismaClient, token)).id,
    clinician.id,
  );

  const logout = createLogoutHandler(dependencies);
  assert.equal((await logout(token)).status, 204);
  assert.equal(await resolveClinicianSession(prismaClient, token), null);
  assert.equal((await logout(token)).status, 204);
  assert.equal(writes.at(-1)[1], "");
  assert.equal(writes.at(-1)[2].maxAge, 0);
});

test("failed login handlers use generic errors and never set cookies", async () => {
  const activeClinician = await createClinician();
  const cases = [
    {
      clinician: activeClinician,
      email: activeClinician.email,
      password: "incorrect",
    },
    {
      clinician: activeClinician,
      email: "unknown@example.test",
      password: "incorrect",
    },
    {
      clinician: { ...activeClinician, status: "DISABLED" },
      email: activeClinician.email,
      password: "correct-password",
    },
  ];
  const responses = [];

  for (const testCase of cases) {
    const writes = [];
    const login = createLoginHandler({
      prismaClient: createSessionPrisma(testCase.clinician),
      getCookieStore: async () => ({
        set: (...parameters) => writes.push(parameters),
      }),
      onInternalError: () => assert.fail("Unexpected internal error"),
    });
    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testCase.email,
          password: testCase.password,
        }),
      }),
    );

    responses.push({
      status: response.status,
      body: await response.json(),
    });
    assert.equal(writes.length, 0);
  }

  assert.deepEqual(responses, [
    {
      status: 401,
      body: { error: "Invalid email or password." },
    },
    {
      status: 401,
      body: { error: "Invalid email or password." },
    },
    {
      status: 401,
      body: { error: "Invalid email or password." },
    },
  ]);
});

test("the Patient model and routes contain no patient authentication", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const patientModel = schema.match(/model Patient \{[\s\S]*?\n\}/)?.[0];

  assert.ok(patientModel);
  assert.doesNotMatch(
    patientModel,
    /password|credential|session|login|authentication/i,
  );

  const repositoryFiles = [
    "src/app/api/auth/login/route.js",
    "src/app/api/auth/logout/route.js",
    "src/app/(public)/login/page.js",
  ];

  for (const file of repositoryFiles) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /patient.*(login|password|session)/i);
  }
});
