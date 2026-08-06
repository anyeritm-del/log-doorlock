import { google, sheets_v4 } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
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

/** Creates a brand-new Google Sheet (via Drive) for a hotel and returns its spreadsheet ID. */
export async function createHotelSpreadsheet(hotelName: string): Promise<string> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Door Lock Logs - ${hotelName}` },
      sheets: [{ properties: { title: "Floor 1" } }],
    },
  });
  const spreadsheetId = res.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Google Sheets did not return a spreadsheetId when creating the hotel sheet.");
  }

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
    requestBody: { type: "user", role: "writer", emailAddress: email },
  });
}
