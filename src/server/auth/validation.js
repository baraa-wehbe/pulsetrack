import { z } from "zod";

import { normalizeClinicianEmail } from "@/lib/clinician-email";

export const loginInputSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1)
      .max(320)
      .email()
      .transform(normalizeClinicianEmail),
    password: z.string().min(1).max(1024),
  })
  .strict();

export const safeReturnPath = (value) => {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/login")
  ) {
    return "/";
  }

  return value;
};
