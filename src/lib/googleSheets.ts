import { google, sheets_v4 } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  // "drive.file" only grants access to files the service account itself created —
  // it can't see folders a human shares with it via the sharing UI. Since hotel
  // sheets get moved into a human-managed shared folder (DRIVE_FOLDER_ID), the
  // broader "drive" scope is needed.
  "https://www.googleapis.com/auth/drive",
];

function getServiceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set. See SETUP.md."
    );
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  });
}

let sheetsClient: sheets_v4.Sheets | null = null;
function getSheetsClient(): sheets_v4.Sheets {
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: "v4", auth: getServiceAccountAuth() });
  }
  return sheetsClient;
}

let driveClient: ReturnType<typeof google.drive> | null = null;
function getDriveClient() {
  if (!driveClient) {
    driveClient = google.drive({ version: "v3", auth: getServiceAccountAuth() });
  }
  return driveClient;
}

/** Reads every row of a sheet/tab, including the header row, as raw string cells. */
export async function readSheetRows(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values as string[][] | undefined) ?? [];
}

/** Appends rows to the end of a sheet/tab. Creates the tab first if it doesn't exist. */
export async function appendSheetRows(
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  await ensureTabExists(spreadsheetId, sheetName, [
    "Date",
    "Time",
    "Card",
    "Encoded by",
    "Date",
    "Time",
  ]);

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

/** Lists the tab (sheet) names present in a spreadsheet. */
export async function listTabNames(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));
}

async function ensureTabExists(
  spreadsheetId: string,
  sheetName: string,
  headerRow: string[]
): Promise<void> {
  const existing = await listTabNames(spreadsheetId);
  if (existing.includes(sheetName)) return;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headerRow] },
  });
}

/** Creates a brand-new Google Sheet for a hotel and returns its spreadsheet ID. */
export async function createHotelSpreadsheet(hotelName: string): Promise<string> {
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId) {
    // Service accounts have no Drive storage quota of their own, so
    // sheets.spreadsheets.create() (which always lands in the service account's
    // own Drive) fails with "The caller does not have permission". Creating the
    // file directly inside a human-owned shared folder borrows that owner's
    // quota, which is why DRIVE_FOLDER_ID is required, not just for browsability.
    throw new Error(
      "DRIVE_FOLDER_ID must be set to create hotel sheets — service accounts have no " +
        "Drive storage quota of their own. See SETUP.md step 5."
    );
  }

  const drive = getDriveClient();
  const file = await drive.files.create({
    requestBody: {
      name: `Door Lock Logs - ${hotelName}`,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    },
    // Required whenever the parent lives in a Shared Drive, which is what
    // DRIVE_FOLDER_ID is expected to be — see SETUP.md step 5.
    supportsAllDrives: true,
    fields: "id",
  });
  const spreadsheetId = file.data.id;
  if (!spreadsheetId) {
    throw new Error("Google Drive did not return a file id when creating the hotel sheet.");
  }

  const sheets = getSheetsClient();
  const created = await sheets.spreadsheets.get({ spreadsheetId });
  const defaultSheetId = created.data.sheets?.[0]?.properties?.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: defaultSheetId, title: "Floor 1" }, fields: "title" } },
      ],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Floor 1'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Date", "Time", "Card", "Encoded by", "Date", "Time"]],
    },
  });

  return spreadsheetId;
}

/** Shares a spreadsheet as Editor with a specific user (e.g. the admin who requested it). */
export async function shareSpreadsheetWithUser(
  spreadsheetId: string,
  email: string
): Promise<void> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId: spreadsheetId,
    sendNotificationEmail: false,
    supportsAllDrives: true,
    requestBody: { type: "user", role: "writer", emailAddress: email },
  });
}
