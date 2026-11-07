import type { AuditReport } from "@/lib/audit";
import { DataTable, EmptyState, SectionTitle, cardClass, tdClass, trClass } from "@/components/ui";

/** Security checks for one room (moved here from the hotel-wide security report). */
export function RoomSecurity({ report }: { report: AuditReport }) {
  // Upkey (v3) data has no encoder column, so the non-PMS check only applies to other formats.
  const showNonPms = !report.hasUpkeyData || report.hasEncoderData;
  const masterLabel = report.hasUpkeyData ? "master/staff card" : "master/floor card";

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Security check</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label={`After-hours ${masterLabel} access`}
          value={report.afterHoursMasterAccess.length}
        />
        {report.hasUpkeyData && (
          <SummaryCard label="Guest entry 00:00–05:00" value={report.guestEarlyMorning.length} />
        )}
        {showNonPms && <SummaryCard label="Keys not encoded via PMS" value={report.nonPmsEncodes.length} />}
      </div>

      <h3 className="text-sm font-bold text-gray-700">After-hours {masterLabel} access (20:00–07:00)</h3>
      {report.afterHoursMasterAccess.length === 0 ? (
        <EmptyState>No after-hours {masterLabel} access found.</EmptyState>
      ) : (
        <DataTable headers={["Date/Time", "Card", "Hour"]}>
          {report.afterHoursMasterAccess.map((e, i) => (
            <tr key={i} className={trClass}>
              <td className={tdClass}>{e.dateTime}</td>
              <td className={tdClass}>{e.cardLabel}</td>
              <td className={tdClass}>{e.hour}</td>
            </tr>
          ))}
        </DataTable>
      )}

      {report.hasUpkeyData && (
        <>
          <h3 className="text-sm font-bold text-gray-700">Guest entry 00:00–05:00</h3>
          {report.guestEarlyMorning.length === 0 ? (
            <EmptyState>No guest card entries between 00:00 and 05:00.</EmptyState>
          ) : (
            <DataTable headers={["Date/Time", "Card"]}>
              {report.guestEarlyMorning.map((e, i) => (
                <tr key={i} className={trClass}>
                  <td className={tdClass}>{e.dateTime}</td>
                  <td className={tdClass}>{e.user}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      )}

      {showNonPms && (
        <>
          <h3 className="text-sm font-bold text-gray-700">Keys not encoded via PMS</h3>
          {report.nonPmsEncodes.length === 0 ? (
            <EmptyState>No non-PMS key encoding events found.</EmptyState>
          ) : (
            <DataTable headers={["Date/Time", "Card", "Encoded by"]}>
              {report.nonPmsEncodes.map((e, i) => (
                <tr key={i} className={trClass}>
                  <td className={tdClass}>{e.dateTime}</td>
                  <td className={tdClass}>{e.cardLabel}</td>
                  <td className={tdClass}>{e.encoder}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </>
      )}
    </section>
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
      <div className="mt-1 text-xs text-brand-grey">{flagged ? "Needs review" : "Nothing to review"}</div>
    </div>
  );
}
