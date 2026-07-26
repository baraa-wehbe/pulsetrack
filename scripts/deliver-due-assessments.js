import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { runAssessmentJob } from "@/server/assessments/service";

try {
  const result = await runAssessmentJob(prisma);
  console.log(
    `Assessment delivery complete: ${result.processed} processed, ${result.delivered} delivered, ${result.failed} failed, ${result.skipped} skipped, ${result.cancelled} cancelled, ${result.expired} expired.`,
  );
} catch (error) {
  console.error("Scheduled assessment delivery failed.", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
