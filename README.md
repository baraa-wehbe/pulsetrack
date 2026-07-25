# PulseTrack

PulseTrack will be a remote patient monitoring platform for clinicians and
patients.

## Current status

This repository contains the application and database foundation, immutable
reference-data seeding, and clinician-only credentials authentication. Patient
management, questionnaire delivery, lab importing, dashboards, FHIR, and AI
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
npm test             # Run the unit test suite
npm run test:auth    # Run clinician authentication unit tests
```

## Source structure

- `src/app`: Next.js App Router pages, layouts, and global styles
- `src/components`: shared UI components
- `src/config`: centralized application configuration and environment validation
- `src/lib`: shared framework-independent utilities
- `src/server`: server-only authentication and future backend domain code
- `src/modules`: domain-oriented architectural placeholders
- `prisma`: database schema, migrations, and reviewed hardening SQL

The domain folders under `src/modules` reserve boundaries for future work in
authentication, clinicians, patients, questionnaires, lab results, dashboards,
notifications, FHIR, and AI insights. They are inactive placeholders and contain
no feature implementation.
