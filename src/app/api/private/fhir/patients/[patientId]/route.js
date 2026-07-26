import { env } from "@/config/env.mjs";
import { patientIdentifierRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import { createFhirClient } from "@/server/fhir/client";
import {
  checkPatientRemoteStatus,
  FhirManagementError,
  requestPatientSynchronization,
} from "@/server/fhir/management";

export const dynamic = "force-dynamic";

const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });

const patientIdentifier = async (params) => {
  const parsed = patientIdentifierRouteParamsSchema.safeParse(await params);
  return parsed.success ? parsed.data.patientId : null;
};

const configured = () =>
  Boolean(
    env.FHIR_BASE_URL &&
    env.FHIR_API_KEY &&
    env.FHIR_MRN_IDENTIFIER_SYSTEM &&
    env.FHIR_LAB_RESULT_IDENTIFIER_SYSTEM,
  );

const safeError = (error) => {
  if (!(error instanceof FhirManagementError)) return null;
  if (error.code === "NOT_FOUND") {
    return json({ error: "Patient not found.", code: "NOT_FOUND" }, 404);
  }
  if (error.code === "READ_ONLY") {
    return json(
      { error: "Externally owned resources are read-only.", code: "READ_ONLY" },
      409,
    );
  }
  return json({ error: "FHIR action failed safely." }, 400);
};

export const POST = withClinicianAuthentication(
  async (_request, { params }) => {
    const identifier = await patientIdentifier(params);
    if (!identifier) return json({ error: "Invalid patient identifier." }, 400);
    if (!configured()) {
      return json({ error: "FHIR synchronization is not configured." }, 503);
    }
    try {
      return json(await requestPatientSynchronization(prisma, identifier), 202);
    } catch (error) {
      const response = safeError(error);
      if (response) return response;
      return json({ error: "FHIR action failed safely." }, 500);
    }
  },
);

export const GET = withClinicianAuthentication(async (_request, { params }) => {
  const identifier = await patientIdentifier(params);
  if (!identifier) return json({ error: "Invalid patient identifier." }, 400);
  if (!configured()) {
    return json({
      remoteStatus: "NOT_CONFIGURED",
      localSyncStatus: "NOT_SYNCED",
      ownership: "NONE",
    });
  }
  try {
    const client = createFhirClient({
      baseUrl: env.FHIR_BASE_URL,
      apiKey: env.FHIR_API_KEY,
      timeoutMs: env.FHIR_REQUEST_TIMEOUT_MS,
    });
    return json(
      await checkPatientRemoteStatus(
        prisma,
        client,
        identifier,
        env.FHIR_MRN_IDENTIFIER_SYSTEM,
      ),
    );
  } catch (error) {
    const response = safeError(error);
    if (response) return response;
    return json({ error: "FHIR status check failed safely." }, 500);
  }
});
