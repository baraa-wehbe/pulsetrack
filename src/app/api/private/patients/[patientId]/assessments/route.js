import { createAssessmentRequestSchemaForDate } from "@/lib/assessment-validation";
import { patientIdentifierRouteParamsSchema } from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import {
  assessmentJson,
  assessmentServiceErrorResponse,
  assessmentValidationResponse,
} from "@/server/assessments/http";
import { createAssessment } from "@/server/assessments/service";
import { readJsonBody } from "@/server/patients/http";

export const POST = withClinicianAuthentication(
  async (request, { clinician, params }) => {
    const parsedParams = patientIdentifierRouteParamsSchema.safeParse(
      await params,
    );
    if (!parsedParams.success) {
      return assessmentJson(
        {
          error: "Invalid patient identifier.",
          code: "INVALID_PATIENT_ID",
        },
        { status: 400 },
      );
    }

    const body = await readJsonBody(request);
    if (!body.success) {
      return assessmentJson(
        {
          error: "Invalid assessment input.",
          code: "VALIDATION_ERROR",
          fieldErrors: {},
        },
        { status: 400 },
      );
    }

    const parsed = createAssessmentRequestSchemaForDate().safeParse(body.data);
    if (!parsed.success) {
      return assessmentValidationResponse(parsed.error);
    }

    try {
      const result = await createAssessment(
        prisma,
        clinician.id,
        parsedParams.data.patientId,
        parsed.data,
      );

      return assessmentJson(result, { status: 201 });
    } catch (error) {
      const safeResponse = assessmentServiceErrorResponse(error);
      if (safeResponse) return safeResponse;

      console.error("Assessment creation failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return assessmentJson(
        { error: "Internal server error.", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }
  },
);
