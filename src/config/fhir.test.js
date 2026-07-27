import assert from "node:assert/strict";
import test from "node:test";

import {
  FhirConfigurationError,
  resolveFhirConfiguration,
} from "@/config/fhir.mjs";

const complete = {
  baseUrl: "https://fhir.example.test/fhir",
  apiKey: "test-key-not-a-real-credential",
  candidateId: "candidate-test",
  mrnIdentifierSystem: "https://example.test/mrn",
  resultIdentifierSystem: "https://example.test/lab-result",
  timeoutMs: 10_000,
};

test("FHIR integration is disabled only when every optional value is absent", () => {
  assert.deepEqual(resolveFhirConfiguration({ timeoutMs: 10_000 }), {
    enabled: false,
  });
});

test("complete FHIR configuration includes the candidate identity", () => {
  assert.deepEqual(resolveFhirConfiguration(complete), {
    enabled: true,
    ...complete,
  });
});

test("partial FHIR configuration fails without exposing configured values", () => {
  assert.throws(
    () =>
      resolveFhirConfiguration({
        baseUrl: complete.baseUrl,
        timeoutMs: complete.timeoutMs,
      }),
    (error) =>
      error instanceof FhirConfigurationError &&
      error.message.includes("FHIR_API_KEY") &&
      error.message.includes("FHIR_CANDIDATE_ID") &&
      !error.message.includes(complete.baseUrl),
  );
});
