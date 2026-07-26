import assert from "node:assert/strict";
import test from "node:test";

import { createFhirClient } from "./client.js";
import {
  mapFhirObservationForPull,
  mapFhirPatientForPull,
  pullSeedPatientsAndObservations,
  SEED_PATIENT_MRNS,
  SeedPullError,
} from "./seed-pull.js";

const system = "https://candidate.example/mrn";
const catalog = [
  {
    code: "HBA1C",
    loincCode: "4548-4",
    defaultUnit: "%",
    defaultRefLow: "4",
    defaultRefHigh: "5.6",
  },
];

const remotePatient = (mrn, id = `patient-${mrn.slice(-4)}`) => ({
  resourceType: "Patient",
  id,
  active: true,
  identifier: [{ system, value: mrn }],
  name: [{ use: "official", given: ["Seed"], family: "Patient" }],
  gender: "unknown",
  birthDate: "1990-01-01",
  meta: { versionId: "2" },
});

const remoteObservation = (id = "observation-1") => ({
  resourceType: "Observation",
  id,
  status: "final",
  code: {
    coding: [{ system: "http://loinc.org", code: "4548-4" }],
  },
  effectiveDateTime: "2026-01-02T08:00:00Z",
  valueQuantity: { value: 6.4, code: "%" },
  subject: { reference: "Patient/patient-2001" },
  meta: { versionId: "3" },
});

test("pull mappers normalize safe Patient and supported Observation fields", () => {
  const patient = mapFhirPatientForPull(
    {
      ...remotePatient("MRN-2001"),
      telecom: [
        { system: "email", value: " Seed@Example.TEST " },
        { system: "phone", value: "+961123456" },
      ],
    },
    "MRN-2001",
    system,
  );
  assert.equal(patient.mrn, "MRN-2001");
  assert.equal(patient.email, "seed@example.test");
  assert.equal(patient.origin, "FHIR");
  assert.equal(patient.fhirOwnership, "EXTERNAL_READ_ONLY");

  const observation = mapFhirObservationForPull(
    remoteObservation(),
    "local-patient",
    "patient-2001",
    catalog,
    new Date("2026-07-26T00:00:00.000Z"),
  );
  assert.equal(observation.testCode, "HBA1C");
  assert.equal(observation.unit, "%");
  assert.equal(observation.source, "FHIR");
  assert.equal(observation.fhirOwnership, "EXTERNAL_READ_ONLY");
});

test("unsupported codes, units, and malformed resources are rejected safely", () => {
  assert.throws(
    () =>
      mapFhirObservationForPull(
        {
          ...remoteObservation(),
          code: {
            coding: [{ system: "http://loinc.org", code: "unsupported" }],
          },
        },
        "patient",
        "patient-2001",
        catalog,
        new Date("2026-07-26T00:00:00.000Z"),
      ),
    (error) =>
      error instanceof SeedPullError &&
      error.code === "UNSUPPORTED_OBSERVATION",
  );
  assert.throws(
    () =>
      mapFhirObservationForPull(
        {
          ...remoteObservation(),
          subject: { reference: "Patient/a-different-patient" },
        },
        "patient",
        "patient-2001",
        catalog,
        new Date("2026-07-26T00:00:00.000Z"),
      ),
    (error) =>
      error instanceof SeedPullError && error.code === "MALFORMED_OBSERVATION",
  );
  assert.throws(
    () =>
      mapFhirPatientForPull(
        { ...remotePatient("MRN-2001"), birthDate: "2026-02-30" },
        "MRN-2001",
        system,
      ),
    (error) =>
      error instanceof SeedPullError && error.code === "MALFORMED_PATIENT",
  );
});

test("pull command queries only the fixed five-MRN scope and imports safe entries", async () => {
  const paths = [];
  const patients = [];
  const observations = [];
  let storedRun;
  const prisma = {
    fhirSyncRun: {
      create: async () => ({ id: "run-1" }),
      update: async ({ data }) => {
        storedRun = data;
        return { id: "run-1" };
      },
    },
    labTest: { findMany: async () => catalog },
  };
  const client = {
    getBundle: async (path) => {
      paths.push(path);
      if (path.startsWith("Patient?")) {
        const mrn = SEED_PATIENT_MRNS.find((value) =>
          path.includes(encodeURIComponent(value)),
        );
        return [{ resource: remotePatient(mrn) }];
      }
      const patientId = decodeURIComponent(path).split("/").at(-1);
      return [
        {
          resource: {
            ...remoteObservation(`observation-${paths.length}`),
            subject: { reference: `Patient/${patientId}` },
          },
        },
        {
          resource: {
            ...remoteObservation(`unsupported-${paths.length}`),
            subject: { reference: `Patient/${patientId}` },
            code: {
              coding: [{ system: "http://loinc.org", code: "9999-9" }],
            },
          },
        },
      ];
    },
  };

  const result = await pullSeedPatientsAndObservations(prisma, client, {
    mrnIdentifierSystem: system,
    now: () => new Date("2026-07-26T00:00:00.000Z"),
    patientUpserter: async (_prisma, mapped) => {
      patients.push(mapped);
      return {
        id: `local-${patients.length}`,
        fhirResourceId: mapped.fhirResourceId,
      };
    },
    observationUpserter: async (_prisma, mapped) => {
      observations.push(mapped);
    },
  });

  assert.deepEqual(
    paths
      .filter((path) => path.startsWith("Patient?"))
      .map((path) => decodeURIComponent(path).split("|").at(-1)),
    SEED_PATIENT_MRNS,
  );
  assert.equal(paths.length, 10);
  assert.equal(patients.length, 5);
  assert.equal(observations.length, 5);
  assert.equal(result.skipped, 5);
  assert.equal(result.failed, 0);
  assert.equal(storedRun.checkpoint.outcomes.UNSUPPORTED_OBSERVATION, 5);
  assert.doesNotMatch(JSON.stringify(storedRun), /MRN-200[1-5]|6\.4/);
});

test("FHIR client follows every same-origin Observation next link", async () => {
  const urls = [];
  const client = createFhirClient({
    apiKey: "server-secret",
    baseUrl: "https://fhir.example.test/r4/",
    fetchImpl: async (url) => {
      urls.push(url.toString());
      const second = url.searchParams.get("page") === "2";
      return new Response(
        JSON.stringify({
          resourceType: "Bundle",
          entry: [{ resource: remoteObservation(second ? "two" : "one") }],
          link: second
            ? []
            : [
                {
                  relation: "next",
                  url: "https://fhir.example.test/r4/Observation?page=2",
                },
              ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/fhir+json" },
        },
      );
    },
  });

  const entries = await client.getBundle(
    "Observation?subject=Patient%2Fpatient-2001",
  );
  assert.equal(entries.length, 2);
  assert.equal(urls.length, 2);
});
