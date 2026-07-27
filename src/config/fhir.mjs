export const FHIR_REQUIRED_CONFIGURATION_KEYS = Object.freeze([
  "baseUrl",
  "apiKey",
  "candidateId",
  "mrnIdentifierSystem",
  "resultIdentifierSystem",
]);

const environmentName = (key) =>
  ({
    baseUrl: "FHIR_BASE_URL",
    apiKey: "FHIR_API_KEY",
    candidateId: "FHIR_CANDIDATE_ID",
    mrnIdentifierSystem: "FHIR_MRN_IDENTIFIER_SYSTEM",
    resultIdentifierSystem: "FHIR_LAB_RESULT_IDENTIFIER_SYSTEM",
  })[key];

export class FhirConfigurationError extends Error {
  constructor(missingKeys) {
    super(
      `Incomplete FHIR configuration. Check: ${missingKeys
        .map(environmentName)
        .join(", ")}`,
    );
    this.name = "FhirConfigurationError";
    this.missingKeys = missingKeys;
  }
}

export const resolveFhirConfiguration = (configuration) => {
  const presentKeys = FHIR_REQUIRED_CONFIGURATION_KEYS.filter(
    (key) => configuration[key] !== undefined,
  );

  if (presentKeys.length === 0) {
    return Object.freeze({ enabled: false });
  }

  const missingKeys = FHIR_REQUIRED_CONFIGURATION_KEYS.filter(
    (key) => configuration[key] === undefined,
  );
  if (missingKeys.length > 0) {
    throw new FhirConfigurationError(missingKeys);
  }

  return Object.freeze({ enabled: true, ...configuration });
};
