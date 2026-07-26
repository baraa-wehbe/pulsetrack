# Patients

Patient route, validation, UI, and server-service implementations currently
live in the shared App Router, component, library, and server directories. This
module boundary remains available for future patient-domain organization
without creating a second backend or storage layer.

The protected list accepts `search`, `origin`, `ownership`, `syncStatus`,
`page`, and `pageSize`. Its shared Zod schema defaults to no search, `all` for
the three enum filters, page `1`, and page size `10`; allowed sizes are `10`,
`25`, and `50`. Search is split on whitespace and every token must match at
least one of MRN, first name, or last name in PostgreSQL.

FHIR badges map the schema states directly:

- Source: `LOCAL` or `FHIR`
- Ownership: `NONE`, `CANDIDATE_OWNED`, or `EXTERNAL_READ_ONLY`
- Sync: `NOT_SYNCED`, `PENDING`, `SYNCED`, or `FAILED`

No live FHIR checks or raw synchronization errors are exposed by the list.
Send and Schedule routes are protected clinician workflows backed by the shared
assessment delivery service.

The detail route uses the normalized MRN (`/patients/[mrn]`) and resolves only
rows where `archived_at IS NULL`. It renders safe demographics and assessment
history ordered by assessment creation time descending with ID used only as a
database ordering fallback. Stored response totals and risk bands are displayed;
the DSMA-8 maximum is read from the stored questionnaire definition. Token
hashes, recipient addresses, answer payloads, scoring snapshots, provider
errors, and internal assessment identifiers are not selected for the page.
Failed delivery is represented by a derived safe state.
