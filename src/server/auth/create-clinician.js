import { z } from "zod";

import { normalizeClinicianEmail } from "@/lib/clinician-email";
import { hashPassword } from "@/server/auth/password";

export const createClinicianInputSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1)
      .max(320)
      .email()
      .transform(normalizeClinicianEmail),
    password: z.string().min(12).max(1024),
    fullName: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  })
  .strict();

export class ClinicianCreationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ClinicianCreationError";
    this.code = code;
  }
}

const isUniqueConstraintError = (error) =>
  error &&
  typeof error === "object" &&
  "code" in error &&
  error.code === "P2002";

export const createActiveClinician = async (
  prismaClient,
  input,
  passwordHasher = hashPassword,
) => {
  const parsed = createClinicianInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new ClinicianCreationError(
      "INVALID_INPUT",
      "Invalid clinician details. Check the email, password length, and full name.",
    );
  }

  const { email, password, fullName } = parsed.data;
  const existingClinician = await prismaClient.clinician.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingClinician) {
    throw new ClinicianCreationError(
      "DUPLICATE_EMAIL",
      `A clinician with email ${email} already exists.`,
    );
  }

  const passwordHash = await passwordHasher(password);

  try {
    return await prismaClient.clinician.create({
      data: {
        email,
        passwordHash,
        fullName,
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ClinicianCreationError(
        "DUPLICATE_EMAIL",
        `A clinician with email ${email} already exists.`,
      );
    }

    throw error;
  }
};
