import {
  patientArchiveSchema,
  patientIdentifierRouteParamsSchema,
} from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import {
  patientInternalErrorResponse,
  patientJson,
  patientRouteValidationResponse,
  patientServiceErrorResponse,
  patientValidationResponse,
  readJsonBody,
} from "@/server/patients/http";
import { archivePatient } from "@/server/patients/service";

export const POST = withClinicianAuthentication(
  async (request, { clinician, params }) => {
    const parsedParams = patientIdentifierRouteParamsSchema.safeParse(
      await params,
    );

    if (!parsedParams.success) {
      return patientRouteValidationResponse();
    }

    const body = await readJsonBody(request);

    if (!body.success) {
      return patientJson(
        { error: "Invalid archive input.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const parsedBody = patientArchiveSchema.safeParse(body.data);

    if (!parsedBody.success) {
      return patientValidationResponse(parsedBody.error);
    }

    try {
      const result = await archivePatient(
        prisma,
        clinician.id,
        parsedParams.data.patientId,
      );

      return patientJson(result);
    } catch (error) {
      const safeError = patientServiceErrorResponse(error);

      if (safeError) {
        return safeError;
      }

      console.error("Patient archive failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });

      return patientInternalErrorResponse();
    }
  },
);
