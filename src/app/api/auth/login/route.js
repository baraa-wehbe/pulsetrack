import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { createLoginHandler } from "@/server/auth/handlers";

export const POST = createLoginHandler({
  prismaClient: prisma,
  getCookieStore: cookies,
  onInternalError: (error) => {
    console.error("Clinician login failed due to an internal error.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  },
});
