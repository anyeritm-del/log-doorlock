import { listTabNames, readSheetRows } from "@/lib/googleSheets";
import { detectSheetFormat, filterJunkRows, rawLogRowFromCells, type RawLogRow } from "@/lib/parseCard";
import { upkeyTabFor } from "@/lib/floorTabs";

/** All log rows of a floor: its main tab followed by its Upkey companion tab, if any. Each tab is
 * parsed with the format of its own header, so one floor can hold rows of several formats. */
export async function readFloorLogRows(spreadsheetId: string, floorName: string): Promise<RawLogRow[]> {
  const tabs = await listTabNames(spreadsheetId);
  const sources = [floorName, upkeyTabFor(floorName)].filter((t) => tabs.includes(t));
  const tabRows = await Promise.all(sources.map((t) => readSheetRows(spreadsheetId, t)));
  return tabRows.flatMap((rows) => {
    const format = detectSheetFormat(rows[0] ?? []);
    return filterJunkRows(rows.slice(1)).map((cells) => rawLogRowFromCells(cells, format));
  });
}
