import { env } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { createAssessmentJobHandler } from "@/server/assessments/job-http";

export const dynamic = "force-dynamic";

export const POST = createAssessmentJobHandler({
  configuredSecret: env.SCHEDULER_SECRET,
  prismaClient: prisma,
});
