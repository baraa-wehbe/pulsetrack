# FHIR

The Tier 1 foundation provides a server-only FHIR R4 HTTP client and pure
Patient/Observation mapping functions under `src/server/fhir`.

The client supports API-key authentication, FHIR JSON headers, bounded
timeouts, same-origin Bundle pagination, bounded `429` retries, and sanitized
OperationOutcome errors. Mappers require deployment-specific identifier-system
URLs instead of inventing namespaces. Patient MRNs are normalized identifiers;
lab observations use authoritative LOINC catalog coding and UCUM quantities.

No synchronization worker, event handler, import, push, or user interface is
implemented yet.
