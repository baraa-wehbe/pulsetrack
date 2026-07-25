import { AUTH_COOKIE_NAME } from "@/config/auth";
import { prisma } from "@/lib/prisma";
import { resolveClinicianSession } from "@/server/auth/session";

export const unauthorizedResponse = () =>
  Response.json({ error: "Unauthorized." }, { status: 401 });

export const withClinicianAuthentication = (handler) => async (request) => {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let clinician;

  try {
    clinician = await resolveClinicianSession(prisma, token);
  } catch (error) {
    console.error("Private API authentication failed internally.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return Response.json({ error: "Internal server error." }, { status: 500 });
  }

  if (!clinician) {
    return unauthorizedResponse();
  }

  return handler(request, { clinician });
};
