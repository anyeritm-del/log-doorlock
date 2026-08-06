# Door Lock Logs

Multi-hotel door lock access log viewer. Browse **Hotel → Floor → Room** to see a room's card
encoding history, and upload new Excel/CSV log exports to keep it up to date.

Google Sheets is the database: one spreadsheet per hotel (a tab per floor), plus one shared
"registry" spreadsheet listing hotels and which users can access them. See [SETUP.md](./SETUP.md)
for the one-time Google Cloud / spreadsheet setup required before this will run anywhere.

## Development

```bash
npm install
cp .env.local.example .env.local   # fill in the values from SETUP.md
npm run dev
```

Open http://localhost:3000.

## Tests

```bash
npm test
```

Covers the Card-column parsing logic (`src/lib/parseCard.ts`) that classifies rows into rooms,
master/staff keys, and New Guest dividers.

## Deploying

Deployed on Vercel. Env vars must be set in the Vercel project (see SETUP.md) — there's nothing to
configure in code for a new environment.
