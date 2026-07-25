import {
  createPatientSchemaForDate,
  getLocalDateOnly,
  patientListQuerySchema,
} from "@/lib/patient-validation";
import { prisma } from "@/lib/prisma";
import { withClinicianAuthentication } from "@/server/auth/api";
import {
  patientInternalErrorResponse,
  patientJson,
  patientServiceErrorResponse,
  patientValidationResponse,
  readJsonBody,
} from "@/server/patients/http";
import { createPatient, listActivePatients } from "@/server/patients/service";

export const GET = withClinicianAuthentication(async (request) => {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsedQuery = patientListQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return patientValidationResponse(parsedQuery.error);
  }

  try {
    const patients = await listActivePatients(prisma);

    return patientJson({ patients });
  } catch (error) {
    console.error("Patient list failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });

    return patientInternalErrorResponse();
  }
});

export const POST = withClinicianAuthentication(
  async (request, { clinician }) => {
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

    const parsed = createPatientSchemaForDate(getLocalDateOnly()).safeParse(
      body.data,
    );

    if (!parsed.success) {
      return patientValidationResponse(parsed.error);
    }

    try {
      const patient = await createPatient(prisma, clinician.id, parsed.data);

      return patientJson({ patient }, { status: 201 });
    } catch (error) {
      const safeError = patientServiceErrorResponse(error);

      if (safeError) {
        return safeError;
      }

      console.error("Patient creation failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });

      return patientInternalErrorResponse();
    }
  },
);
