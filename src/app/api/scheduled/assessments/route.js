import { env } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { createAssessmentJobHandler } from "@/server/assessments/job-http";

export const dynamic = "force-dynamic";

export const GET = createAssessmentJobHandler({
  configuredSecret: env.CRON_SECRET ?? env.SCHEDULER_SECRET,
  prismaClient: prisma,
});

export const POST = createAssessmentJobHandler({
  configuredSecret: env.SCHEDULER_SECRET ?? env.CRON_SECRET,
  prismaClient: prisma,
});
