import "dotenv/config";

import { prisma } from "@/lib/prisma";
import {
  expireSentAssessments,
  processDueAssessments,
} from "@/server/assessments/service";

try {
  const now = new Date();
  const expired = await expireSentAssessments(prisma, now);
  const result = await processDueAssessments(prisma, { now });
  console.log(
    `Assessment delivery complete: ${result.processed} processed, ${result.delivered} delivered, ${result.failed} failed, ${result.skipped} skipped, ${expired} expired.`,
  );
} catch (error) {
  console.error("Scheduled assessment delivery failed.", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
