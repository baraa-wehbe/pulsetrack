# FHIR

The Tier 1 foundation provides a server-only FHIR R4 HTTP client and pure
Patient/Observation mapping functions under `src/server/fhir`.

The client supports API-key authentication, FHIR JSON headers, bounded
timeouts, same-origin Bundle pagination, bounded `429` retries, and sanitized
OperationOutcome errors. Mappers require deployment-specific identifier-system
URLs instead of inventing namespaces. Patient MRNs are normalized identifiers;
lab observations use authoritative LOINC catalog coding and UCUM quantities.

Patient push work is persisted in the existing `fhir_sync_tasks` table and can
be processed with `npm run fhir:sync-patients`. The worker requires
`FHIR_BASE_URL`, `FHIR_API_KEY`, `FHIR_MRN_IDENTIFIER_SYSTEM`, and
`FHIR_LAB_RESULT_IDENTIFIER_SYSTEM`; these values remain server-only.

Accepted CSV lab results are coalesced into Observation push tasks and wait for
a confirmed candidate-owned Patient reference.

`npm run fhir:pull-seeds` performs the bounded manual pull for seed MRNs
`MRN-2001` through `MRN-2005` and their supported historical Observations.
The protected `/fhir-sync` page presents safe retry-run history and failed-task
summaries. Continuous polling remains deferred.
