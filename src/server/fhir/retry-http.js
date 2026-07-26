import { createFhirClient } from "@/server/fhir/client";
import { runFhirRetryJob } from "@/server/fhir/retry-job";
import { isSchedulerAuthorized } from "@/server/assessments/scheduler-auth";

const json = (body, status) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });

export const createFhirRetryHandler =
  ({
    configuredSecret,
    prismaClient,
    fhirConfiguration,
    runJob = runFhirRetryJob,
  }) =>
  async (request) => {
    if (
      !isSchedulerAuthorized(
        request.headers.get("authorization"),
        configuredSecret,
      )
    ) {
      return json({ error: "Unauthorized." }, 401);
    }
    if (
      !fhirConfiguration.baseUrl ||
      !fhirConfiguration.apiKey ||
      !fhirConfiguration.mrnIdentifierSystem ||
      !fhirConfiguration.resultIdentifierSystem
    ) {
      return json({ error: "FHIR synchronization is not configured." }, 503);
    }
    try {
      const client = createFhirClient({
        baseUrl: fhirConfiguration.baseUrl,
        apiKey: fhirConfiguration.apiKey,
        timeoutMs: fhirConfiguration.timeoutMs,
      });
      const result = await runJob(prismaClient, {
        client,
        mrnIdentifierSystem: fhirConfiguration.mrnIdentifierSystem,
        resultIdentifierSystem: fhirConfiguration.resultIdentifierSystem,
      });
      return json(result, 200);
    } catch (error) {
      console.error("Scheduled FHIR retry failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return json({ error: "FHIR retry processing failed." }, 500);
    }
  };
