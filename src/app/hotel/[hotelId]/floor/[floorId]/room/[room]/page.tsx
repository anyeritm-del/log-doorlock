import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { readSheetRows } from "@/lib/googleSheets";
import { listFloorNames, listRoomRoster } from "@/lib/rooms";
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
  const entries = roomGroup?.entries ?? [];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        <Link href={`/hotel/${hotelId}`} className="hover:underline">
          {hotel.hotelName}
        </Link>{" "}
        /{" "}
        <Link href={`/hotel/${hotelId}/floor/${floorId}`} className="hover:underline">
          {floorName}
        </Link>{" "}
        / Room {roomNumber}
      </p>
      <h1 className="text-lg font-semibold">Room {roomNumber}</h1>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">No activity yet.</p>
      ) : format === "v2" ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-white">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Card Type</th>
                <th className="px-3 py-2">Card No.</th>
                <th className="px-3 py-2">Key Name</th>
                <th className="px-3 py-2">Key Location</th>
                <th className="px-3 py-2">Issuer</th>
                <th className="px-3 py-2">Time Issued</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                if (entry.row.format !== "v2") return null;
                return (
                  <Fragment key={i}>
                    {entry.hasNewGuestBefore && (
                      <tr className="bg-gray-100">
                        <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-gray-500">
                          New Guest
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2">{entry.row.date}</td>
                      <td className="px-3 py-2">{entry.row.cardType}</td>
                      <td className="px-3 py-2">{entry.row.cardNumber}</td>
                      <td className="px-3 py-2">{entry.row.keyName}</td>
                      <td className="px-3 py-2">{entry.row.keyLocation}</td>
                      <td className="px-3 py-2">{entry.row.issuer}</td>
                      <td className="px-3 py-2">{entry.row.timeIssued}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-left text-white">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Card</th>
                <th className="px-3 py-2">Encoded by</th>
                <th className="px-3 py-2">Encoded Date</th>
                <th className="px-3 py-2">Encoded Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                if (entry.row.format !== "v1") return null;
                return (
                  <Fragment key={i}>
                    {entry.hasNewGuestBefore && (
                      <tr className="bg-gray-100">
                        <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold text-gray-500">
                          New Guest
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-100">
                      <td className="px-3 py-2">{entry.row.date}</td>
                      <td className="px-3 py-2">{entry.row.time}</td>
                      <td className="px-3 py-2">
                        {roomNumber}
                        {entry.variant && entry.variant !== "Primary" ? ` ${entry.variant}` : ""}
                      </td>
                      <td className="px-3 py-2">{entry.row.encodedBy}</td>
                      <td className="px-3 py-2">{entry.row.encodedDate}</td>
                      <td className="px-3 py-2">{entry.row.encodedTime}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
