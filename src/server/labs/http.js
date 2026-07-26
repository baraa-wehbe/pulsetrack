import { env } from "@/config/env.mjs";
import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import {
  LabUploadValidationError,
  validateLabCsvFile,
} from "@/server/labs/validation";
import { processLabImport } from "@/server/labs/processing";
import { createLabImport, listLabImports } from "@/server/labs/service";

const labJson = (body, init = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, private",
      ...init.headers,
    },
  });

const validationResponse = (code) =>
  labJson({ error: "Invalid lab CSV upload.", code }, { status: 400 });

export const GET = withClinicianAuthentication(
  async (_request, { clinician }) => {
    try {
      return labJson({
        imports: await listLabImports(prisma, clinician.id),
      });
    } catch (error) {
      console.error("Lab import history failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return labJson({ error: "Internal server error." }, { status: 500 });
    }
  },
);

export const POST = withClinicianAuthentication(
  async (request, { clinician }) => {
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return validationResponse("INVALID_FORM");
    }

    try {
      const metadata = await validateLabCsvFile(
        formData.get("file"),
        env.LAB_CSV_MAX_BYTES,
      );
      const labImport = await createLabImport(prisma, clinician.id, metadata);
      const processed = await processLabImport(
        prisma,
        labImport.id,
        metadata.bytes,
      );
      return labJson({ labImport: processed }, { status: 201 });
    } catch (error) {
      if (error instanceof LabUploadValidationError) {
        return validationResponse(error.code);
      }
      console.error("Lab import creation failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return labJson({ error: "Internal server error." }, { status: 500 });
    }
  },
);
