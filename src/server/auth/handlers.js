import { clearAuthCookie, setAuthCookie } from "@/config/auth";
import { authenticateClinicianCredentials } from "@/server/auth/credentials";
import {
  createClinicianSession,
  revokeClinicianSession,
} from "@/server/auth/session";

const INVALID_CREDENTIALS = "Invalid email or password.";
const INVALID_INPUT = "Invalid login input.";

export const createLoginHandler =
  ({ prismaClient, getCookieStore, onInternalError }) =>
  async (request) => {
    let input;

    try {
      input = await request.json();
    } catch {
      return Response.json({ error: INVALID_INPUT }, { status: 400 });
    }

    try {
      const authentication = await authenticateClinicianCredentials(
        prismaClient,
        input,
      );

      if (!authentication.ok) {
        const status = authentication.kind === "validation" ? 400 : 401;
        const error =
          authentication.kind === "validation"
            ? INVALID_INPUT
            : INVALID_CREDENTIALS;

        return Response.json({ error }, { status });
      }

      const session = await createClinicianSession(
        prismaClient,
        authentication.clinicianId,
      );
      const cookieStore = await getCookieStore();
      setAuthCookie(cookieStore, session.token, session.expiresAt);

      return Response.json({ clinician: authentication.clinician });
    } catch (error) {
      onInternalError(error);
      return Response.json(
        { error: "Internal server error." },
        { status: 500 },
      );
    }
  };

export const createLogoutHandler =
  ({ prismaClient, getCookieStore, onInternalError }) =>
  async (token) => {
    const cookieStore = await getCookieStore();

    try {
      await revokeClinicianSession(prismaClient, token);
    } catch (error) {
      onInternalError(error);
      clearAuthCookie(cookieStore);

      return Response.json(
        { error: "Internal server error." },
        { status: 500 },
      );
    }

    clearAuthCookie(cookieStore);
    return new Response(null, { status: 204 });
  };
