import { withClinicianAuthentication } from "@/server/auth/api";
import { createLabTemplateDownloadHandler } from "@/server/labs/template-http";

export const GET = withClinicianAuthentication(
  createLabTemplateDownloadHandler(),
);
