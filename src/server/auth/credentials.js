import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/server/auth/password";
import { toPublicClinician } from "@/server/auth/clinician";
import { loginInputSchema } from "@/server/auth/validation";

const clinicianCredentialSelect = {
  id: true,
  email: true,
  passwordHash: true,
  fullName: true,
  status: true,
  preferredLocale: true,
  themePreference: true,
};

export const authenticateClinicianCredentials = async (prismaClient, input) => {
  const parsed = loginInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, kind: "validation" };
  }

  const clinician = await prismaClient.clinician.findUnique({
    where: { email: parsed.data.email },
    select: clinicianCredentialSelect,
  });
  const passwordMatches = await verifyPassword(
    clinician?.passwordHash ?? DUMMY_PASSWORD_HASH,
    parsed.data.password,
  );

  if (!clinician || !passwordMatches || clinician.status !== "ACTIVE") {
    return { ok: false, kind: "authentication" };
  }

  return {
    ok: true,
    clinicianId: clinician.id,
    clinician: toPublicClinician(clinician),
  };
};
