import { getFieldErrors } from "@/lib/patient-validation";
import { PatientServiceError } from "@/server/patients/service";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export const patientJson = (body, init = {}) =>
  Response.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...init.headers,
    },
  });

export const patientValidationResponse = (error) =>
  patientJson(
    {
      error: "Invalid patient input.",
      code: "VALIDATION_ERROR",
      fieldErrors: getFieldErrors(error),
    },
    { status: 400 },
  );

export const patientRouteValidationResponse = () =>
  patientJson(
    {
      error: "Invalid patient identifier.",
      code: "INVALID_PATIENT_ID",
    },
    { status: 400 },
  );

export const patientServiceErrorResponse = (error) => {
  if (!(error instanceof PatientServiceError)) {
    return null;
  }

  if (error.code === "NOT_FOUND") {
    return patientJson(
      { error: "Patient not found.", code: "PATIENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (error.code === "MRN_CONFLICT") {
    return patientJson(
      {
        error: "A patient with this MRN already exists.",
        code: "MRN_CONFLICT",
        fieldErrors: { mrn: "mrn_conflict" },
      },
      { status: 409 },
    );
  }

  if (error.code === "ARCHIVED") {
    return patientJson(
      {
        error: "Archived patients cannot be edited.",
        code: "PATIENT_ARCHIVED",
      },
      { status: 409 },
    );
  }

  return null;
};

export const patientInternalErrorResponse = () =>
  patientJson(
    { error: "Internal server error.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );

export const readJsonBody = async (request) => {
  try {
    return { success: true, data: await request.json() };
  } catch {
    return { success: false };
  }
};
