import { requireHotelAccess } from "@/lib/authz";
import { listFloorNames } from "@/lib/rooms";
import { readFloorLogRows } from "@/lib/floorData";
import { buildAuditReport } from "@/lib/audit";
import { DataTable, EmptyState, PageHeader, SectionTitle, cardClass, tdClass, trClass } from "@/components/ui";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = await requireHotelAccess(hotelId);

  const floorNames = await listFloorNames(hotel.sheetId);
  const floors = await Promise.all(
    floorNames.map(async (floor) => ({ floor, rows: await readFloorLogRows(hotel.sheetId, floor) }))
  );

  const report = buildAuditReport(floors);
  // Upkey (v3) data has no encoder column, so the non-PMS check only applies to other formats.
  const showNonPms = !report.hasUpkeyData || report.hasEncoderData;
  const masterLabel = report.hasUpkeyData ? "master/staff card" : "master/floor card";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Security report"
        subtitle="Unusual door lock activity across all floors of this hotel."
        breadcrumbs={[
          { label: "Hotels", href: "/" },
          { label: hotel.hotelName, href: `/hotel/${hotelId}` },
          { label: "Security report" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label={`After-hours ${masterLabel} access`}
          value={report.afterHoursMasterAccess.length}
        />
        {report.hasUpkeyData && (
          <>
            <SummaryCard label="Staff entry while DND was on" value={report.staffDuringDnd.length} />
            <SummaryCard
              label="Guest entry 00:00–05:00"
              value={report.guestEarlyMorning.length}
            />
          </>
        )}
        {showNonPms && (
          <SummaryCard label="Keys not encoded via PMS" value={report.nonPmsEncodes.length} />
        )}
      </div>

      <section className="flex flex-col gap-4">
        <SectionTitle count={report.afterHoursMasterAccess.length}>
          After-hours {masterLabel} access (20:00–07:00)
        </SectionTitle>
        {report.afterHoursMasterAccess.length === 0 ? (
          <EmptyState>No after-hours {masterLabel} access found.</EmptyState>
        ) : (
          <DataTable headers={["Floor", "Date/Time", "Card", "Hour"]}>
            {report.afterHoursMasterAccess.map((e, i) => (
              <tr key={i} className={trClass}>
                <td className={tdClass}>{e.floor}</td>
                <td className={tdClass}>{e.dateTime}</td>
                <td className={tdClass}>{e.cardLabel}</td>
                <td className={tdClass}>{e.hour}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      {report.hasUpkeyData && (
        <section className="flex flex-col gap-4">
          <SectionTitle count={report.staffDuringDnd.length}>
            Staff entry while DND was on
          </SectionTitle>
          {report.staffDuringDnd.length === 0 ? (
            <EmptyState>No staff card entries while Privacy (DND) was on.</EmptyState>
          ) : (
            <DataTable headers={["Floor", "Room", "Entered at", "Staff", "DND on since"]}>
              {report.staffDuringDnd.map((e, i) => (
                <tr key={i} className={trClass}>
                  <td className={tdClass}>{e.floor}</td>
                  <td className={tdClass}>{e.room}</td>
                  <td className={tdClass}>{e.dateTime}</td>
                  <td className={tdClass}>{e.user}</td>
                  <td className={tdClass}>{e.dndSince}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      )}

      {report.hasUpkeyData && (
        <section className="flex flex-col gap-4">
          <SectionTitle count={report.guestEarlyMorning.length}>
            Guest entry 00:00–05:00
          </SectionTitle>
          {report.guestEarlyMorning.length === 0 ? (
            <EmptyState>No guest card entries between 00:00 and 05:00.</EmptyState>
          ) : (
            <DataTable headers={["Floor", "Room", "Date/Time", "Card"]}>
              {report.guestEarlyMorning.map((e, i) => (
                <tr key={i} className={trClass}>
                  <td className={tdClass}>{e.floor}</td>
                  <td className={tdClass}>{e.room}</td>
                  <td className={tdClass}>{e.dateTime}</td>
                  <td className={tdClass}>{e.user}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      )}

      {showNonPms && (
        <section className="flex flex-col gap-4">
          <SectionTitle count={report.nonPmsEncodes.length}>Keys not encoded via PMS</SectionTitle>
          {report.nonPmsEncodes.length === 0 ? (
            <EmptyState>No non-PMS key encoding events found.</EmptyState>
          ) : (
            <DataTable headers={["Floor", "Date/Time", "Card", "Encoded by"]}>
              {report.nonPmsEncodes.map((e, i) => (
                <tr key={i} className={trClass}>
                  <td className={tdClass}>{e.floor}</td>
                  <td className={tdClass}>{e.dateTime}</td>
                  <td className={tdClass}>{e.cardLabel}</td>
                  <td className={tdClass}>{e.encoder}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  const flagged = value > 0;
  return (
    <div className={`${cardClass} border-l-4 p-5 ${flagged ? "border-l-amber-500" : "border-l-green-600"}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${flagged ? "text-amber-700" : "text-green-700"}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-brand-grey">
        {flagged ? "Needs review" : "Nothing to review"}
      </div>
    </div>
  );
}
