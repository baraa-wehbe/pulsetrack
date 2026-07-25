import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/config/auth";
import { prisma } from "@/lib/prisma";
import { createLogoutHandler } from "@/server/auth/handlers";

const logout = createLogoutHandler({
  prismaClient: prisma,
  getCookieStore: cookies,
  onInternalError: (error) => {
    console.error("Clinician logout failed to revoke a session.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  },
});

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  return logout(token);
}
