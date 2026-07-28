import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const main = async () => {
  const [{ prisma }, { runAssessmentJob }] = await Promise.all([
    import("@/lib/prisma-client"),
    import("@/server/assessments/service"),
  ]);
  let running = false;

  const runDueAssessments = async () => {
    if (running) return;
    running = true;

    try {
      const result = await runAssessmentJob(prisma);
      if (result.processed > 0 || result.expired > 0) {
        console.log(
          `[scheduler] ${result.processed} processed, ${result.delivered} delivered, ${result.failed} failed, ${result.skipped} skipped, ${result.cancelled} cancelled, ${result.expired} expired.`,
        );
      }
    } catch (error) {
      console.error("[scheduler] Assessment delivery failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      running = false;
    }
  };

  const task = cron.schedule("* * * * *", runDueAssessments, {
    name: "pulsetrack-due-assessments",
    noOverlap: true,
    timezone: "UTC",
  });

  console.log(
    "[scheduler] Watching for due assessments once per minute; running startup check.",
  );
  await runDueAssessments();

  const shutdown = async () => {
    task.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

main().catch((error) => {
  console.error("[scheduler] Worker startup failed.", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
