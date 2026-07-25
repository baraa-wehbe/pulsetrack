import { withClinicianAuthentication } from "@/server/auth/api";

export const GET = withClinicianAuthentication(
  async (_request, { clinician }) => Response.json({ clinician }),
);
