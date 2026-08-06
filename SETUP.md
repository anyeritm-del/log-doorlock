# Setup

This app has no database server of its own — Google Sheets is the backend. Before it can run
anywhere (locally or on Vercel), you need a Google Cloud project, a service account, an OAuth
client, and one manually-created "registry" spreadsheet. None of this can be scripted from here
since it requires your Google Cloud / Workspace console access — follow the steps below.

## 1. Google Cloud project + APIs

1. Go to https://console.cloud.google.com/ and create a new project (or reuse an existing one
   for internal tools).
2. Enable these APIs for the project: **Google Sheets API** and **Google Drive API**.

## 2. Service account (used by the app to read/write Sheets)

1. In the project, go to **IAM & Admin → Service Accounts → Create Service Account**.
2. Give it any name, e.g. `doorlog-app`. No project roles are needed (access is granted per-sheet
   via sharing, not IAM).
3. Open the new service account → **Keys → Add key → Create new key → JSON**. Download it.
4. From that JSON file you'll need two values for env vars:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` escapes as-is when pasting into Vercel's
     env var UI; the app un-escapes them at runtime)

## 3. OAuth client (used for staff/admin Google sign-in)

1. In the same project: **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorized redirect URI: `https://<your-vercel-domain>/api/auth/callback/google` (and
   `http://localhost:3000/api/auth/callback/google` for local dev).
4. Copy the client ID and secret → `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
5. If prompted, configure the OAuth consent screen as **Internal** (restricts sign-in to your
   Google Workspace domain) if this is a Workspace account, otherwise **External** and rely on the
   app's own `ALLOWED_EMAIL_DOMAINS` check.

## 4. The registry spreadsheet

This one spreadsheet holds the list of hotels and the list of users — everything else (each
hotel's actual log data) is created automatically by the app.

1. Create a new Google Sheet named e.g. "Door Lock Logs - Registry".
2. Rename the first tab to `Hotels` with header row: `hotel_id, hotel_name, brand, sheet_id,
   created_at`.
3. Add a second tab named `Users` with header row: `email, role, hotel_ids`.
4. Add yourself as the first user so you can sign in and reach the admin pages (there's no way to
   add the first admin through the UI — it has to exist before anyone can sign in):
   `your.email@archipelagohotels.com | admin | ALL`
5. Share the spreadsheet with the service account's `client_email` (from step 2) as **Editor**.
6. Copy the spreadsheet ID from its URL (`https://docs.google.com/spreadsheets/d/<THIS PART>/edit`)
   → `ADMIN_SHEET_ID`.

## 5. (Optional) Shared Drive folder for hotel sheets

By default, each hotel spreadsheet the app creates lands in the service account's own private
Drive space — reachable via its direct link (which gets auto-shared with the admin who created it)
but not browsable in Drive by anyone else. To make every hotel's sheet show up in a shared Drive
folder your whole admin team can browse:

1. Create (or reuse) a Google Drive folder.
2. Share it with the service account's `client_email` as **Editor**.
3. Copy the folder ID from its URL (`https://drive.google.com/drive/folders/<THIS PART>`) →
   `DRIVE_FOLDER_ID`. Leave this unset to skip the shared-folder behavior entirely.

## 6. Environment variables

Set these locally in `.env.local` and in the Vercel project's Environment Variables settings:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
AUTH_SECRET=... # generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
ADMIN_SHEET_ID=...
DRIVE_FOLDER_ID=... # optional, see step 5
ALLOWED_EMAIL_DOMAINS=archipelagohotels.com,astonhotelsinternational.com
```

## 7. Deploying to Vercel

1. Push this repo to GitHub/GitLab/Bitbucket and import it in Vercel, or run `vercel` from this
   directory.
2. Add all the env vars above in the Vercel project settings.
3. Deploy. Once live, update the OAuth client's authorized redirect URI (step 3) to match the
   real Vercel domain if it differs from what you used during setup.

## Notes / known limits

- **Format assumption**: the upload parser assumes every hotel exports logs in the same 6-column
  layout as the sample screenshot (Date, Time, Card, Encoded by, Encoded Date, Encoded Time). If a
  brand's door-lock software exports differently, its files won't parse correctly — flag this
  before onboarding a hotel with an unfamiliar export format.
- **Master key detection** is a heuristic: any Card value that doesn't start with a room number
  (e.g. `FMK (HKS-4)`) is treated as a master/staff key. An unusual room-naming scheme could be
  misclassified — check a hotel's first upload before trusting it.
- **Google Sheets row ceiling**: each hotel's spreadsheet can hold roughly 1.6M log rows in total
  across all floor tabs (Sheets' 10M-cell limit ÷ 6 columns). High-traffic properties may need
  periodic archiving of old floor tabs — not built yet, but worth planning for if a property
  approaches that ceiling.
- **Known dependency advisory**: `exceljs` pulls in a `uuid` version flagged for a buffer-bounds
  issue in its v3/v5/v6 functions; this app never calls those functions (only exceljs's internal
  usage does, for unrelated ID generation), so it's not reachable here, but re-check `npm audit`
  when upgrading dependencies.
