import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import { createLabValidationReportHandler } from "@/server/labs/report-http";

export const GET = withClinicianAuthentication(
  createLabValidationReportHandler({ prismaClient: prisma }),
);
