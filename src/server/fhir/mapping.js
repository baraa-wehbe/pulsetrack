import "server-only";

const FHIR_ID = /^[A-Za-z0-9.-]{1,64}$/;
const IDENTIFIER_SYSTEM = /^https?:\/\/\S+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const GENDER = Object.freeze({
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
  UNKNOWN: "unknown",
});
const UCUM_CODES = Object.freeze({
  "mg/dL": "mg/dL",
  "%": "%",
  mmHg: "mm[Hg]",
});

const dateOnly = (value) => {
  if (typeof value === "string" && DATE_ONLY.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  throw new Error("Invalid FHIR date mapping input.");
};

const finiteNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("Invalid FHIR quantity mapping input.");
  }
  return number;
};

const requireSystem = (value) => {
  if (typeof value !== "string" || !IDENTIFIER_SYSTEM.test(value)) {
    throw new Error("A valid identifier system is required.");
  }
  return value;
};

const optionalId = (value) => {
  if (value == null) return null;
  if (!FHIR_ID.test(value)) throw new Error("Invalid FHIR resource id.");
  return value;
};

const requireIdentifierValue = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("A stable local result identifier is required.");
  }
  return value.trim();
};

export const mapPatientToFhir = (patient, { mrnIdentifierSystem }) => {
  const resourceId = optionalId(patient.fhirResourceId);
  const resource = {
    resourceType: "Patient",
    identifier: [
      {
        use: "usual",
        system: requireSystem(mrnIdentifierSystem),
        value: patient.mrn.trim().toUpperCase(),
      },
    ],
    active: !patient.archivedAt,
    name: [
      {
        use: "official",
        family: patient.lastName.trim(),
        given: [patient.firstName.trim()],
      },
    ],
    gender: GENDER[patient.sex] ?? "unknown",
    birthDate: dateOnly(patient.dateOfBirth),
  };

  if (resourceId) resource.id = resourceId;
  const telecom = [];
  if (patient.email) {
    telecom.push({
      system: "email",
      value: patient.email.trim().toLowerCase(),
      use: "home",
    });
  }
  if (patient.phone) {
    telecom.push({
      system: "phone",
      value: patient.phone.trim(),
      use: "home",
    });
  }
  if (telecom.length > 0) resource.telecom = telecom;

  return resource;
};

const quantity = (value, unit) => {
  const code = UCUM_CODES[unit];
  if (!code) {
    throw new Error("The authoritative lab unit is unsupported.");
  }
  return {
    value: finiteNumber(value),
    unit,
    system: "http://unitsofmeasure.org",
    code,
  };
};

export const mapLabResultToFhirObservation = (
  labResult,
  labTest,
  { resultIdentifierSystem, patientFhirResourceId },
) => {
  const resourceId = optionalId(labResult.fhirResourceId);
  const patientId = optionalId(patientFhirResourceId);
  if (!patientId) throw new Error("A patient FHIR resource id is required.");
  if (!labTest?.loincCode || !labTest?.defaultUnit || !labTest?.name) {
    throw new Error("Authoritative lab catalog data is required.");
  }

  const resource = {
    resourceType: "Observation",
    identifier: [
      {
        system: requireSystem(resultIdentifierSystem),
        value: requireIdentifierValue(labResult.id),
      },
    ],
    status: "final",
    category: [
      {
        coding: [
          {
            system:
              "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "laboratory",
            display: "Laboratory",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: labTest.loincCode,
          display: labTest.name,
        },
      ],
      text: labTest.name,
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: dateOnly(labResult.collectedDate),
    valueQuantity: quantity(labResult.value, labTest.defaultUnit),
  };

  if (resourceId) resource.id = resourceId;
  const low =
    labTest.defaultRefLow == null
      ? null
      : quantity(labTest.defaultRefLow, labTest.defaultUnit);
  const high =
    labTest.defaultRefHigh == null
      ? null
      : quantity(labTest.defaultRefHigh, labTest.defaultUnit);
  if (low || high) {
    resource.referenceRange = [
      {
        ...(low ? { low } : {}),
        ...(high ? { high } : {}),
      },
    ];
  }

  return resource;
};
