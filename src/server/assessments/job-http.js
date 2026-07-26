import { runAssessmentJob } from "@/server/assessments/service";
import { isSchedulerAuthorized } from "@/server/assessments/scheduler-auth";

const json = (body, status) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });

export const createAssessmentJobHandler =
  ({
    configuredSecret,
    prismaClient,
    runJob = runAssessmentJob,
    nowFactory = () => new Date(),
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

    try {
      const result = await runJob(prismaClient, { now: nowFactory() });
      return json(
        {
          processed: result.processed,
          delivered: result.delivered,
          failed: result.failed,
          skipped: result.skipped,
          cancelled: result.cancelled,
          expired: result.expired,
        },
        200,
      );
    } catch (error) {
      console.error("Scheduled assessment job failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return json({ error: "Scheduled processing failed." }, 500);
    }
  };
