import { Fragment } from "react";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { readSheetRows } from "@/lib/googleSheets";
import { listFloorNames, listRoomRoster } from "@/lib/rooms";
import { isPrivacyEnabled, isPrivacyEvent, isUpkeyStaffCard } from "@/lib/upkey";
import { DataTable, EmptyState, PageHeader, tdClass, trClass } from "@/components/ui";
import { buildFloorIndex, detectSheetFormat, filterJunkRows, rawLogRowFromCells } from "@/lib/parseCard";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ hotelId: string; floorId: string; room: string }>;
}) {
  const { hotelId, floorId, room } = await params;
  const floorName = decodeURIComponent(floorId);
  const roomNumber = decodeURIComponent(room);
  const hotel = await requireHotelAccess(hotelId);

  const floors = await listFloorNames(hotel.sheetId);
  if (!floors.includes(floorName)) notFound();

  const [roster, rows] = await Promise.all([
    listRoomRoster(hotel.sheetId, floorName),
    readSheetRows(hotel.sheetId, floorName),
  ]);
  const format = detectSheetFormat(rows[0] ?? []);
  const dataRows = filterJunkRows(rows.slice(1)).map((cells) => rawLogRowFromCells(cells, format));
  const index = buildFloorIndex(dataRows);
  const roomGroup = index.rooms.find((r) => r.room === roomNumber);
  // Allow a registered room with no log activity yet (empty state) as well as an
  // unregistered room that already has log entries (edge case, see floor page).
  if (!roomGroup && !roster.includes(roomNumber)) notFound();
  const sheetEntries = roomGroup?.entries ?? [];
  // Upkey rows can come from several overlapping PDF uploads, so order them by lock date
  // (newest first). Other formats keep sheet order, which their New Guest dividers rely on.
  const entries =
    format === "v3"
      ? [...sheetEntries].sort((a, b) =>
          a.row.format === "v3" && b.row.format === "v3"
            ? b.row.lockDate.localeCompare(a.row.lockDate)
            : 0
        )
      : sheetEntries;

  const crumbs = [
    { label: "Hotels", href: "/" },
    { label: hotel.hotelName, href: `/hotel/${hotelId}` },
    { label: floorName, href: `/hotel/${hotelId}/floor/${floorId}` },
    { label: `Room ${roomNumber}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Room ${roomNumber}`}
        subtitle={`${entries.length} access ${entries.length === 1 ? "entry" : "entries"}`}
        breadcrumbs={crumbs}
      />

      {entries.length === 0 ? (
        <EmptyState>No activity yet.</EmptyState>
      ) : format === "v3" ? (
        <DataTable headers={["Lock date", "Event", "User", "Success"]}>
          {entries.map((entry, i) => {
            if (entry.row.format !== "v3") return null;
            const row = entry.row;
            return (
              <tr key={i} className={isPrivacyEvent(row) ? "bg-gray-50" : trClass}>
                <td className={tdClass}>{row.lockDate}</td>
                <td className={tdClass}>
                  {isPrivacyEvent(row) ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isPrivacyEnabled(row) ? "bg-amber-100 text-amber-800" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {isPrivacyEnabled(row) ? "DND on" : "DND off"}
                    </span>
                  ) : (
                    row.recordType
                  )}
                </td>
                <td className={tdClass}>
                  {row.user}
                  {isUpkeyStaffCard(row) && (
                    <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                      Staff
                    </span>
                  )}
                </td>
                <td className={tdClass}>
                  {row.success === "Yes" ? "✓" : row.success === "No" ? (
                    <span className="font-bold text-red-700">✗ Failed</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      ) : format === "v2" ? (
        <DataTable
          headers={["Date", "Card Type", "Card No.", "Key Name", "Key Location", "Issuer", "Time Issued"]}
        >
          {entries.map((entry, i) => {
            if (entry.row.format !== "v2") return null;
            return (
              <Fragment key={i}>
                {entry.hasNewGuestBefore && <NewGuestRow colSpan={7} />}
                <tr className={trClass}>
                  <td className={tdClass}>{entry.row.date}</td>
                  <td className={tdClass}>{entry.row.cardType}</td>
                  <td className={tdClass}>{entry.row.cardNumber}</td>
                  <td className={tdClass}>{entry.row.keyName}</td>
                  <td className={tdClass}>{entry.row.keyLocation}</td>
                  <td className={tdClass}>{entry.row.issuer}</td>
                  <td className={tdClass}>{entry.row.timeIssued}</td>
                </tr>
              </Fragment>
            );
          })}
        </DataTable>
      ) : (
        <DataTable headers={["Date", "Time", "Card", "Encoded by", "Encoded Date", "Encoded Time"]}>
          {entries.map((entry, i) => {
            if (entry.row.format !== "v1") return null;
            return (
              <Fragment key={i}>
                {entry.hasNewGuestBefore && <NewGuestRow colSpan={6} />}
                <tr className={trClass}>
                  <td className={tdClass}>{entry.row.date}</td>
                  <td className={tdClass}>{entry.row.time}</td>
                  <td className={tdClass}>
                    {roomNumber}
                    {entry.variant && entry.variant !== "Primary" ? ` ${entry.variant}` : ""}
                  </td>
                  <td className={tdClass}>{entry.row.encodedBy}</td>
                  <td className={tdClass}>{entry.row.encodedDate}</td>
                  <td className={tdClass}>{entry.row.encodedTime}</td>
                </tr>
              </Fragment>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}

function NewGuestRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="bg-brand-soft">
      <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-bold tracking-wider text-brand uppercase">
        New guest
      </td>
    </tr>
  );
}
