import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const main = async () => {
  const [{ prisma }, { runAssessmentJob }] = await Promise.all([
    import("@/lib/prisma-client"),
    import("@/server/assessments/service"),
  ]);

  try {
    const result = await runAssessmentJob(prisma);
    console.log(
      `Assessment delivery complete: ${result.processed} processed, ${result.delivered} delivered, ${result.failed} failed, ${result.skipped} skipped, ${result.cancelled} cancelled, ${result.expired} expired.`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("Scheduled assessment delivery failed.", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
