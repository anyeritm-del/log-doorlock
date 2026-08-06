import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHotelAccess } from "@/lib/authz";
import { listTabNames, readSheetRows } from "@/lib/googleSheets";
import { buildFloorIndex, type RawLogRow } from "@/lib/parseCard";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ hotelId: string; floorId: string; room: string }>;
}) {
  const { hotelId, floorId, room } = await params;
  const floorName = decodeURIComponent(floorId);
  const roomNumber = decodeURIComponent(room);
  const hotel = await requireHotelAccess(hotelId);

  const tabs = await listTabNames(hotel.sheetId);
  if (!tabs.includes(floorName)) notFound();

  const rows = await readSheetRows(hotel.sheetId, floorName);
  const dataRows: RawLogRow[] = rows.slice(1).map((cells) => ({
    date: cells[0] ?? "",
    time: cells[1] ?? "",
    card: cells[2] ?? "",
    encodedBy: cells[3] ?? "",
    encodedDate: cells[4] ?? "",
    encodedTime: cells[5] ?? "",
  }));
  const index = buildFloorIndex(dataRows);
  const roomGroup = index.rooms.find((r) => r.room === roomNumber);
  if (!roomGroup) notFound();

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
            {roomGroup.entries.map((entry, i) => (
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
                    {entry.variant !== "Primary" ? ` ${entry.variant}` : ""}
                  </td>
                  <td className="px-3 py-2">{entry.row.encodedBy}</td>
                  <td className="px-3 py-2">{entry.row.encodedDate}</td>
                  <td className="px-3 py-2">{entry.row.encodedTime}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
