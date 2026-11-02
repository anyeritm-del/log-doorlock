// Naming rules for the tabs in a hotel's Google Sheet. No I/O here, so it stays unit-testable.

export const ROOMS_TAB = "Rooms";

// A floor whose main tab already holds another log format keeps its Upkey (v3) rows in a
// companion tab, e.g. "1st Floor (Upkey)". The app shows both tabs as one floor.
export const UPKEY_TAB_SUFFIX = " (Upkey)";

export function upkeyTabFor(floorName: string): string {
  return `${floorName}${UPKEY_TAB_SUFFIX}`;
}

export function isUpkeyCompanionTab(tabName: string): boolean {
  return tabName.endsWith(UPKEY_TAB_SUFFIX);
}

// Old rows the app could not read are moved out of a floor tab into "<floor> (backup <date>)"
// before a per-room export replaces them. Backup tabs are kept for reference, never shown as floors.
const BACKUP_TAB = / \(backup [^)]*\)$/;

export function backupTabFor(floorName: string, date: Date): string {
  return `${floorName} (backup ${date.toISOString().slice(0, 10)})`;
}

export function isBackupTab(tabName: string): boolean {
  return BACKUP_TAB.test(tabName);
}

/** Floor names from a spreadsheet's tabs: drops the Rooms and backup tabs and folds each
 * companion "<floor> (Upkey)" tab into its floor. */
export function floorNamesFromTabs(tabs: string[]): string[] {
  const floors: string[] = [];
  for (const tab of tabs) {
    if (tab === ROOMS_TAB || isBackupTab(tab)) continue;
    const floor = isUpkeyCompanionTab(tab) ? tab.slice(0, -UPKEY_TAB_SUFFIX.length) : tab;
    if (!floors.includes(floor)) floors.push(floor);
  }
  return floors;
}

/** Whether a name can't be used for a floor the user creates. */
export function isReservedFloorName(name: string): boolean {
  return name === ROOMS_TAB || isUpkeyCompanionTab(name) || isBackupTab(name);
}
