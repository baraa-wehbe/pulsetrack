import {
  createPatientUpdateSchemaForDate,
  getLocalDateOnly,
  patientRouteParamsSchema,
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
import { getPatientById, updatePatient } from "@/server/patients/service";

const getPatientId = async (params) => {
  const parsed = patientRouteParamsSchema.safeParse(await params);

  return parsed.success ? parsed.data.patientId : null;
};

export const GET = withClinicianAuthentication(async (_request, { params }) => {
  const patientId = await getPatientId(params);

  if (!patientId) {
    return patientRouteValidationResponse();
  }

  try {
    const patient = await getPatientById(prisma, patientId);

    if (!patient) {
      return patientJson(
        { error: "Patient not found.", code: "PATIENT_NOT_FOUND" },
        { status: 404 },
      );
    }

    return patientJson({ patient });
  } catch (error) {
    console.error("Patient detail failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return patientInternalErrorResponse();
  }
});

export const PATCH = withClinicianAuthentication(
  async (request, { clinician, params }) => {
    const patientId = await getPatientId(params);

    if (!patientId) {
      return patientRouteValidationResponse();
    }

    const body = await readJsonBody(request);

    if (!body.success) {
      return patientJson(
        {
          error: "Invalid patient input.",
          code: "VALIDATION_ERROR",
          fieldErrors: {},
        },
        { status: 400 },
      );
    }

    const parsed = createPatientUpdateSchemaForDate(
      getLocalDateOnly(),
    ).safeParse(body.data);

    if (!parsed.success) {
      return patientValidationResponse(parsed.error);
    }

    try {
      const result = await updatePatient(
        prisma,
        clinician.id,
        patientId,
        parsed.data,
      );

      return patientJson(result);
    } catch (error) {
      const safeError = patientServiceErrorResponse(error);

      if (safeError) {
        return safeError;
      }

      console.error("Patient update failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });

      return patientInternalErrorResponse();
    }
  },
);
