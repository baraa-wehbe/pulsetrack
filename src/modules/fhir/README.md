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
Stable remote resource IDs plus the local patient/collection-date/test identity
prevent duplicate imports. Imported resources are marked
`EXTERNAL_READ_ONLY`; push workers re-check ownership before any remote write.

The protected `/fhir-sync` page is the primary clinician synchronization
workspace. `POST /api/private/fhir/synchronize` uses the same existing mocked
and server-only workers as the CLIs: it retries eligible persisted push tasks
in Patient-before-Observation order, then performs the bounded seed pull. It
returns only aggregate counts. The page shows enabled/disabled configuration,
latest and in-progress run state, push/import totals, partial failures, and
sanitized retry availability. Patient-level status checks remain secondary.
Continuous polling remains deferred; the initiating button reports active
progress and refreshes persisted status when the request completes.

The five FHIR settings are all-or-none. API keys, candidate identifiers, bearer
values, patient identifiers, remote resource IDs, and provider diagnostics are
never returned by synchronization views or written to browser URLs. Automated
tests always inject a mock client and never call the shared service.
