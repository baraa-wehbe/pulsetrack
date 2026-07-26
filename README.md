# PulseTrack

PulseTrack will be a remote patient monitoring platform for clinicians and
patients.

## Current status

This repository contains the application and database foundation, immutable
reference-data seeding, clinician-only credentials authentication, the
authenticated application shell, and clinician-managed patient records.
Questionnaire delivery, lab importing, dashboard analytics, FHIR, and AI
features are not implemented.

## Requirements

- Node.js 20.19 or newer
- npm
- Docker Desktop or another Docker installation with Compose

## Installation

```bash
npm install
```

Copy the example environment file to the ignored `.env` file and replace its
safe placeholders when needed:

```bash
cp .env.example .env
```

The application requires:

- `DATABASE_URL`: a valid database URL
- `AUTH_SECRET`: a secret containing at least 32 characters
- `NEXT_PUBLIC_APP_URL`: the public application URL

Only `NEXT_PUBLIC_APP_URL` is intended for browser use. Never commit real
environment files or credentials.

## Local PostgreSQL

Start the PostgreSQL 17 development database:

```bash
npm run db:up
```

Check its container health and stop it without deleting its data:

```bash
npm run db:status
npm run db:down
```

Application code running directly on Windows connects to PostgreSQL through
`localhost:5433`. A future application container on the Compose network would
connect through the service hostname and port `db:5432`.

The database uses a persistent Docker volume. Running
`docker compose down -v` permanently deletes the local PulseTrack database
volume and all data stored in it.

## Prisma workflow

Format and validate the Prisma schema, then regenerate the ignored Prisma
Client:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
```

Use development migrations while changing the schema locally:

```bash
npm run db:migrate
npm run db:migrate:status
```

`prisma migrate dev` creates and applies migrations during development.
Committed migrations are applied to an empty or deployment database with:

```bash
npm run db:deploy
```

`prisma migrate deploy` only applies existing committed migrations. The project
uses migrations as its reproducible database history; `prisma db push` is not
the normal migration workflow.

Seed the immutable DSMA-8 questionnaire and supported lab-test catalog after
applying migrations:

```bash
npm run db:seed
```

The seed is idempotent. It rejects conflicting questionnaire version `1.0` or
lab mappings instead of overwriting established reference data.

## Clinician authentication

PulseTrack authenticates clinicians with normalized lowercase email addresses
and Argon2id password hashes. Successful login creates an opaque server-side
session. Only a random session token is sent to the browser in an `HttpOnly`,
`SameSite=Lax` cookie; production cookies also use `Secure`. Sessions expire
after eight hours, are revoked during logout, and are rejected immediately when
the clinician is disabled.

The public authentication routes are `/login`, `/api/auth/login`, and the
idempotent `/api/auth/logout`. The root application page is protected by its
server layout, and private APIs live under `/api/private` and use the centralized
clinician authentication wrapper. There are no patient accounts or patient
authentication flows.

## Authenticated application shell

Authenticated clinicians share one protected responsive shell with destinations
for Patients, Lab Uploads, Clinic Dashboard, and Patient Dashboard. The
lab-upload and dashboard destinations remain accessible placeholders until
their later feature tasks.

Language and theme preferences use separate first-party cookies:

- `pulsetrack_language`: `en` or `ar`; default `en`
- `pulsetrack_theme`: `light` or `dark`; default `light`

Valid cookies take precedence over the fixed defaults. Invalid or missing values
fall back deterministically to English and light mode. Both cookies are
`HttpOnly`, `SameSite=Lax`, scoped to `/`, valid for one year, and `Secure` in
production. The root server layout reads them before rendering and applies the
document language, direction, and theme, so Arabic RTL and dark mode do not rely
on client-only initialization. Logout does not clear these non-sensitive
preferences.

### Create a development clinician

Create the first local clinician with the administrative CLI:

```powershell
npm run clinician:create -- --email clinician@example.local --password "YOUR_SECURE_DEVELOPMENT_PASSWORD" --name "Development Clinician"
```

The command validates and normalizes the email, hashes the password with the
same Argon2id configuration used by login, and creates an `ACTIVE` clinician.
It does not print the password or stored password hash. This remains a local
administrative command; PulseTrack does not expose a registration page or
account-creation API.

## Patient management

Authenticated active clinicians can list, create, view, edit, and archive
patient records under `/patients`. Editable fields are MRN, first name, last
name, date of birth, biological sex, optional email, and optional phone.

One shared Zod module validates browser and API input. MRNs are trimmed and
uppercased, emails are trimmed and lowercased, optional blank contact values
become `null`, and future or invalid calendar dates are rejected. PostgreSQL’s
existing unique MRN constraint remains authoritative; normalized conflicts
return a safe `409` field error.

Archive is a soft delete through the existing `archived_at` column. The default
list queries only rows where `archived_at IS NULL`, while archived records
remain available by direct detail URL. Create, changed update, and first archive
mutations write clinician-attributed entries to the existing `audit_logs` table
inside the same Prisma transaction. No patient accounts, passwords, sessions,
or login routes exist.

The patient list uses URL parameters for server-side search, FHIR-state
filters, and pagination. Supported parameters are `search`, `origin`,
`ownership`, `syncStatus`, `page`, and `pageSize`; defaults are an empty search,
all enum states, page `1`, and page size `10`. Page sizes are limited to `10`,
`25`, or `50`. Multi-word search requires every token to match MRN, first name,
or last name in PostgreSQL. Results are ordered by last name, first name, MRN,
then patient ID. Source, ownership, and sync badges display the stored Prisma
enum values without live FHIR calls. Send and Schedule lead to authenticated
assessment delivery workflows.

Patient MRNs link to active-only detail routes at `/patients/[mrn]`. The detail
page shows demographics, safe FHIR state badges, and assessment history ordered
by creation time newest first. Completed DSMA-8 entries display the stored total
score and risk band; the score maximum comes from the immutable questionnaire
definition. The route never selects assessment tokens, recipient addresses,
answers, scoring snapshots, provider errors, or internal assessment IDs.
Delivery failure is exposed only as a safe derived state. Archived and unknown
MRNs use the protected localized not-found state. Lab
summary cards remain explicit placeholders until lab-result presentation is
implemented.

### Assessment delivery

Clinicians can send the active DSMA-8 assessment immediately or schedule a
future delivery. Both paths use the same server-only service. A trusted
scheduler processes due work with:

```bash
npm run assessments:deliver-due
```

Configure the server-only `RESEND_API_KEY` and `ASSESSMENT_EMAIL_FROM`
variables documented in `.env.example`. Production schedulers may call
`POST /api/scheduled/assessments` with `Authorization: Bearer <scheduler-secret>`;
configure the server-only `SCHEDULER_SECRET` with at least 32 random characters.
The endpoint and CLI invoke the same delivery-and-expiry job. PostgreSQL
transaction-scoped advisory locks serialize each assessment delivery, and a
stable provider idempotency key protects interrupted retries. Each delivery uses a cryptographically
random token and stores only its SHA-256 hash. The raw token exists only in the
patient link passed to the email provider; it is never returned by the API or
written to logs or audit metadata. Confirmed sends set `sent_at` and an expiry
exactly seven days later. Every success or failure creates a delivery-attempt
row containing only controlled provider metadata and sanitized errors.

The emailed `/assessment/[token]` route exchanges a valid raw token
server-side for a short-lived signed `HttpOnly` access cookie and removes the
raw token from the browser URL. The public `/assessment` page renders all eight
questions and answer options from the immutable stored questionnaire JSON.
Submission validates the exact stored item and option sets and derives the sum
and risk band from the stored scoring bands. A conditional assessment update,
response insert, and audit entry run in one transaction; the unique response
constraint remains the database backstop against duplicate responses.

## Commands

```bash
npm run dev          # Start the development server
npm run build        # Create a production build
npm run start        # Start the production server
npm run lint         # Check code with ESLint
npm run lint:fix     # Fix supported ESLint issues
npm run format       # Format files with Prettier
npm run format:check # Check formatting
npm run db:up        # Start local PostgreSQL
npm run db:status    # Show database container status
npm run db:down      # Stop local PostgreSQL
npm run clinician:create -- --email <email> --password "<password>" --name "<name>"
npm run assessments:deliver-due # Deliver scheduled assessments that are due
npm test             # Run the unit test suite
npm run test:auth    # Run clinician authentication unit tests
npm run test:shell   # Run shell, navigation, language, RTL, and theme tests
npm run test:patients # Run patient validation and UI architecture tests
npm run test:patients:task07 # Run patient-list HTTP, browser, RTL, and axe checks
npm run test:assessments # Run assessment validation and security unit tests
npm run test:assessments:integration # Run mocked-provider database tests
npm run test:assessment-job # Run scheduler authorization and history-status tests
npm run test:public-assessment # Run public form and scoring unit tests
npm run test:public-assessment:integration # Run single-use PostgreSQL tests
npm run test:patients:task08 # Run patient-detail and patient-list browser checks
```

## Source structure

- `src/app`: Next.js App Router pages, layouts, and global styles
- `src/components`: shared UI components
- `src/config`: centralized application configuration and environment validation
- `src/lib`: shared framework-independent utilities
- `src/server`: server-only authentication, patient services, and future domain code
- `src/modules`: domain-oriented architectural placeholders
- `prisma`: database schema, migrations, and reviewed hardening SQL

The domain folders under `src/modules` document boundaries for authentication,
clinicians, patients, questionnaires, lab results, dashboards, notifications,
FHIR, and AI insights. Runtime implementation remains in the App Router,
components, shared libraries, and server-only services rather than a separate
backend application.
