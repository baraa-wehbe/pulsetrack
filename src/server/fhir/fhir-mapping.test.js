import assert from "node:assert/strict";
import test from "node:test";

import { mapLabResultToFhirObservation, mapPatientToFhir } from "./mapping.js";

const patient = {
  id: "local-patient-id",
  mrn: " pt-100 ",
  firstName: " Leila ",
  lastName: " Haddad ",
  dateOfBirth: new Date("1990-04-12T00:00:00.000Z"),
  sex: "FEMALE",
  email: " Leila@Example.TEST ",
  phone: " +961 1 234 567 ",
  archivedAt: null,
  fhirResourceId: "fhir-patient-100",
};

test("Patient mapping uses stable MRN, demographics, telecom, and FHIR id", () => {
  const mapped = mapPatientToFhir(patient, {
    mrnIdentifierSystem: "https://pulsetrack.example/identifier/mrn",
  });

  assert.deepEqual(mapped, {
    resourceType: "Patient",
    id: "fhir-patient-100",
    identifier: [
      {
        use: "usual",
        system: "https://pulsetrack.example/identifier/mrn",
        value: "PT-100",
      },
    ],
    active: true,
    name: [{ use: "official", family: "Haddad", given: ["Leila"] }],
    gender: "female",
    birthDate: "1990-04-12",
    telecom: [
      {
        system: "email",
        value: "leila@example.test",
        use: "home",
      },
      {
        system: "phone",
        value: "+961 1 234 567",
        use: "home",
      },
    ],
  });
});

test("Patient mapping is deterministic, omits absent fields, and marks archives inactive", () => {
  const input = {
    ...patient,
    fhirResourceId: null,
    email: null,
    phone: null,
    archivedAt: new Date(),
    sex: "UNKNOWN",
  };
  const config = {
    mrnIdentifierSystem: "https://pulsetrack.example/identifier/mrn",
  };
  const first = mapPatientToFhir(input, config);
  const second = mapPatientToFhir(input, config);

  assert.deepEqual(first, second);
  assert.equal(first.active, false);
  assert.equal(first.gender, "unknown");
  assert.equal("id" in first, false);
  assert.equal("telecom" in first, false);
});

test("Observation mapping uses LOINC catalog, UCUM quantity, patient reference, and ranges", () => {
  const mapped = mapLabResultToFhirObservation(
    {
      id: "8700ba23-32c7-4d26-9497-35fcf7660f51",
      collectedDate: new Date("2026-07-20T00:00:00.000Z"),
      value: "121.5",
      fhirResourceId: "observation-1",
    },
    {
      code: "SBP",
      name: "Systolic Blood Pressure",
      loincCode: "8480-6",
      defaultUnit: "mmHg",
      defaultRefLow: "90",
      defaultRefHigh: "120",
    },
    {
      patientFhirResourceId: "fhir-patient-100",
      resultIdentifierSystem:
        "https://pulsetrack.example/identifier/lab-result",
    },
  );

  assert.equal(mapped.resourceType, "Observation");
  assert.equal(mapped.id, "observation-1");
  assert.equal(mapped.status, "final");
  assert.deepEqual(mapped.subject, { reference: "Patient/fhir-patient-100" });
  assert.equal(mapped.effectiveDateTime, "2026-07-20");
  assert.deepEqual(mapped.code.coding[0], {
    system: "http://loinc.org",
    code: "8480-6",
    display: "Systolic Blood Pressure",
  });
  assert.deepEqual(mapped.valueQuantity, {
    value: 121.5,
    unit: "mmHg",
    system: "http://unitsofmeasure.org",
    code: "mm[Hg]",
  });
  assert.equal(mapped.referenceRange[0].low.value, 90);
  assert.equal(mapped.referenceRange[0].high.value, 120);
  assert.equal(mapped.referenceRange[0].low.code, "mm[Hg]");
});

test("Observation mapping is deterministic and omits unavailable range bounds", () => {
  const input = {
    id: "result-1",
    collectedDate: "2026-07-20",
    value: 6.1,
    fhirResourceId: null,
  };
  const catalog = {
    name: "Hemoglobin A1c",
    loincCode: "4548-4",
    defaultUnit: "%",
    defaultRefLow: null,
    defaultRefHigh: null,
  };
  const config = {
    patientFhirResourceId: "patient-1",
    resultIdentifierSystem: "https://pulsetrack.example/lab-result",
  };

  const mapped = mapLabResultToFhirObservation(input, catalog, config);
  assert.deepEqual(
    mapped,
    mapLabResultToFhirObservation(input, catalog, config),
  );
  assert.equal("id" in mapped, false);
  assert.equal("referenceRange" in mapped, false);
  assert.equal(mapped.valueQuantity.code, "%");
});

test("mappers reject missing namespaces, invalid references, dates, and quantities", () => {
  assert.throws(() => mapPatientToFhir(patient, {}), /identifier system/);
  assert.throws(
    () =>
      mapLabResultToFhirObservation(
        {
          id: "result-1",
          collectedDate: "not-a-date",
          value: "secret-value",
        },
        {
          name: "Fasting Glucose",
          loincCode: "1558-6",
          defaultUnit: "mg/dL",
        },
        {
          patientFhirResourceId: "bad/id",
          resultIdentifierSystem: "https://example.test/result",
        },
      ),
    /FHIR resource id/,
  );
  assert.throws(
    () =>
      mapLabResultToFhirObservation(
        {
          id: " ",
          collectedDate: "2026-07-20",
          value: 95,
        },
        {
          name: "Fasting Glucose",
          loincCode: "1558-6",
          defaultUnit: "mg/dL",
        },
        {
          patientFhirResourceId: "patient-1",
          resultIdentifierSystem: "https://example.test/result",
        },
      ),
    /stable local result identifier/,
  );
  assert.throws(
    () =>
      mapLabResultToFhirObservation(
        {
          id: "result-1",
          collectedDate: "2026-07-20",
          value: 95,
        },
        {
          name: "Unsupported Test",
          loincCode: "example",
          defaultUnit: "unsupported-unit",
        },
        {
          patientFhirResourceId: "patient-1",
          resultIdentifierSystem: "https://example.test/result",
        },
      ),
    /authoritative lab unit is unsupported/,
  );
});
