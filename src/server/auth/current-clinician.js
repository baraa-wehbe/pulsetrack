import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { AUTH_COOKIE_NAME } from "@/config/auth";
import { prisma } from "@/lib/prisma";
import { resolveClinicianSession } from "@/server/auth/session";

export const getCurrentClinician = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  return resolveClinicianSession(prisma, token);
});

export const requireCurrentClinician = async () => {
  const clinician = await getCurrentClinician();

  if (!clinician) {
    redirect("/login");
  }

  return clinician;
};
