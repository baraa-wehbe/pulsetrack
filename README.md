# PulseTrack

PulseTrack will be a remote patient monitoring platform for clinicians and
patients.

## Current status

This repository currently contains the application foundation only. No business
features are implemented.

## Requirements

- Node.js 20.9 or newer
- npm

## Installation

```bash
npm install
```

Copy the example environment file and replace its safe placeholders with values
for your local environment:

```bash
cp .env.example .env.local
```

The application requires:

- `DATABASE_URL`: a valid database URL
- `AUTH_SECRET`: a secret containing at least 32 characters
- `NEXT_PUBLIC_APP_URL`: the public application URL

Only `NEXT_PUBLIC_APP_URL` is intended for browser use. Never commit real
environment files or credentials.

## Commands

```bash
npm run dev          # Start the development server
npm run build        # Create a production build
npm run start        # Start the production server
npm run lint         # Check code with ESLint
npm run lint:fix     # Fix supported ESLint issues
npm run format       # Format files with Prettier
npm run format:check # Check formatting
```

## Source structure

- `src/app`: Next.js App Router pages, layouts, and global styles
- `src/components`: shared UI components
- `src/config`: centralized application configuration and environment validation
- `src/lib`: shared framework-independent utilities
- `src/server`: future server-only code within the Next.js application
- `src/modules`: domain-oriented architectural placeholders

The domain folders under `src/modules` reserve boundaries for future work in
authentication, clinicians, patients, questionnaires, lab results, dashboards,
notifications, FHIR, and AI insights. They are inactive placeholders and contain
no feature implementation.
