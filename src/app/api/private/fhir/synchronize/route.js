import { fhirConfiguration } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import { createFhirClient } from "@/server/fhir/client";
import { runFullFhirSynchronization } from "@/server/fhir/full-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });

export const POST = withClinicianAuthentication(async () => {
  if (!fhirConfiguration.enabled) {
    return json(
      {
        error: "FHIR synchronization is not configured.",
        code: "NOT_CONFIGURED",
      },
      503,
    );
  }

  try {
    const client = createFhirClient({
      baseUrl: fhirConfiguration.baseUrl,
      apiKey: fhirConfiguration.apiKey,
      timeoutMs: fhirConfiguration.timeoutMs,
    });
    const result = await runFullFhirSynchronization(
      prisma,
      client,
      fhirConfiguration,
    );
    return json(result, result.status === "FAILED" ? 502 : 200);
  } catch (error) {
    console.error("Manual FHIR synchronization failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return json(
      {
        error: "FHIR synchronization could not be completed safely.",
        code: "SYNC_FAILED",
      },
      500,
    );
  }
});
