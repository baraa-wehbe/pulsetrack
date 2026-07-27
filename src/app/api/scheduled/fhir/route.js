import { env, fhirConfiguration } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { createFhirRetryHandler } from "@/server/fhir/retry-http";

export const dynamic = "force-dynamic";

export const POST = createFhirRetryHandler({
  configuredSecret: env.SCHEDULER_SECRET,
  prismaClient: prisma,
  fhirConfiguration,
});
