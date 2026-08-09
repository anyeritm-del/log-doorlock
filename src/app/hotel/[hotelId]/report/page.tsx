import Link from "next/link";
import { requireHotelAccess } from "@/lib/authz";
import { readSheetRows } from "@/lib/googleSheets";
import { listFloorNames } from "@/lib/rooms";
import { detectSheetFormat, filterJunkRows, rawLogRowFromCells } from "@/lib/parseCard";
import { buildAuditReport } from "@/lib/audit";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = await requireHotelAccess(hotelId);

  const floorNames = await listFloorNames(hotel.sheetId);
  const floors = await Promise.all(
    floorNames.map(async (floor) => {
      const rows = await readSheetRows(hotel.sheetId, floor);
      const format = detectSheetFormat(rows[0] ?? []);
      const dataRows = filterJunkRows(rows.slice(1)).map((cells) => rawLogRowFromCells(cells, format));
      return { floor, rows: dataRows };
    })
  );

  const report = buildAuditReport(floors);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-500">
        <Link href={`/hotel/${hotelId}`} className="hover:underline">
          {hotel.hotelName}
        </Link>{" "}
        / Report
      </p>
      <h1 className="text-lg font-semibold">Security report</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-600">
          After-hours master/floor card access (20:00–07:00)
        </h2>
        {report.afterHoursMasterAccess.length === 0 ? (
          <p className="text-sm text-gray-600">No after-hours master/floor card access found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-left text-white">
                <tr>
                  <th className="px-3 py-2">Floor</th>
                  <th className="px-3 py-2">Date/Time</th>
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2">Hour</th>
                </tr>
              </thead>
              <tbody>
                {report.afterHoursMasterAccess.map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">{e.floor}</td>
                    <td className="px-3 py-2">{e.dateTime}</td>
                    <td className="px-3 py-2">{e.cardLabel}</td>
                    <td className="px-3 py-2">{e.hour}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-600">Keys not encoded via PMS</h2>
        {report.nonPmsEncodes.length === 0 ? (
          <p className="text-sm text-gray-600">No non-PMS key encoding events found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-left text-white">
                <tr>
                  <th className="px-3 py-2">Floor</th>
                  <th className="px-3 py-2">Date/Time</th>
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2">Encoded by</th>
                </tr>
              </thead>
              <tbody>
                {report.nonPmsEncodes.map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2">{e.floor}</td>
                    <td className="px-3 py-2">{e.dateTime}</td>
                    <td className="px-3 py-2">{e.cardLabel}</td>
                    <td className="px-3 py-2">{e.encoder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
