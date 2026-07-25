import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import {
  ClinicianCreationError,
  createActiveClinician,
} from "@/server/auth/create-clinician";
import { verifyPassword } from "@/server/auth/password";

const validInput = {
  email: "clinician@example.test",
  password: randomBytes(24).toString("base64url"),
  fullName: "Test Clinician",
};

const createPrismaDouble = ({ existingClinician = null } = {}) => {
  const state = { createData: null };

  return {
    state,
    clinician: {
      findUnique: async () => existingClinician,
      create: async ({ data }) => {
        state.createData = data;

        return {
          id: "clinician-id",
          email: data.email,
          fullName: data.fullName,
          status: data.status,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      },
    },
  };
};

test("creates an ACTIVE clinician with safe public fields", async () => {
  const prismaClient = createPrismaDouble();
  const clinician = await createActiveClinician(prismaClient, validInput);

  assert.equal(clinician.status, "ACTIVE");
  assert.deepEqual(Object.keys(clinician).sort(), [
    "createdAt",
    "email",
    "fullName",
    "id",
    "status",
  ]);
});

test("normalizes stored clinician email to lowercase and trims the name", async () => {
  const prismaClient = createPrismaDouble();

  await createActiveClinician(prismaClient, {
    ...validInput,
    email: "  Clinician@Example.TEST  ",
    fullName: "  Test Clinician  ",
  });

  assert.equal(prismaClient.state.createData.email, "clinician@example.test");
  assert.equal(prismaClient.state.createData.fullName, "Test Clinician");
});

test("stores an Argon2id hash instead of the plaintext password", async () => {
  const prismaClient = createPrismaDouble();

  await createActiveClinician(prismaClient, validInput);

  const storedHash = prismaClient.state.createData.passwordHash;
  assert.notEqual(storedHash, validInput.password);
  assert.match(storedHash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(storedHash, validInput.password), true);
});

test("rejects a duplicate normalized email without hashing or creating", async () => {
  const prismaClient = createPrismaDouble({
    existingClinician: { id: "existing-id" },
  });
  let hashWasCalled = false;

  await assert.rejects(
    createActiveClinician(
      prismaClient,
      { ...validInput, email: "Clinician@Example.Test" },
      async () => {
        hashWasCalled = true;
        return "unused";
      },
    ),
    (error) =>
      error instanceof ClinicianCreationError &&
      error.code === "DUPLICATE_EMAIL" &&
      error.message ===
        "A clinician with email clinician@example.test already exists.",
  );

  assert.equal(hashWasCalled, false);
  assert.equal(prismaClient.state.createData, null);
});

test("rejects invalid email, short passwords, and invalid names", async () => {
  const invalidInputs = [
    { ...validInput, email: "not-an-email" },
    { ...validInput, password: "too-short" },
    { ...validInput, fullName: " " },
    { ...validInput, fullName: "Invalid\u0000Name" },
  ];

  for (const input of invalidInputs) {
    const prismaClient = createPrismaDouble();

    await assert.rejects(
      createActiveClinician(prismaClient, input),
      (error) =>
        error instanceof ClinicianCreationError &&
        error.code === "INVALID_INPUT",
    );
    assert.equal(prismaClient.state.createData, null);
  }
});
