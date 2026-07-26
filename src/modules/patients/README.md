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
Send and Schedule routes are protected informational placeholders only.
