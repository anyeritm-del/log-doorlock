import { requireHotelAccess } from "@/lib/authz";
import { listFloorNames } from "@/lib/rooms";
import { PageHeader, cardClass } from "@/components/ui";
import { UploadForm } from "./UploadForm";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = await requireHotelAccess(hotelId);
  const floors = await listFloorNames(hotel.sheetId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upload a door lock log"
        breadcrumbs={[
          { label: "Hotels", href: "/" },
          { label: hotel.hotelName, href: `/hotel/${hotelId}` },
          { label: "Upload" },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <div className={`${cardClass} p-6`}>
          <UploadForm hotelId={hotelId} floors={floors} />
        </div>
        <aside className="rounded-xl bg-brand-soft p-6 text-sm leading-6 text-gray-700">
          <h2 className="mb-2 font-bold text-brand">File requirements</h2>
          <p>
            Upload an Excel (.xlsx) or CSV export matching the standard 9-column layout (Date,
            Time, Card, Encoded by, Date, Time, Issuer, Time Issued, Room). Rows already present
            in the target floor won&apos;t be duplicated, and rows for room numbers not yet
            registered on that floor will be skipped — register them on the floor page first,
            then re-upload.
          </p>
          <p className="mt-3">
            <span className="font-bold text-brand">Upkey hotels (e.g. Aston Anyer):</span> upload
            the &quot;Lock auditing&quot; PDF for one room. The room and its floor are read from
            the PDF (room 0100 → Floor 1) and created automatically.
          </p>
        </aside>
      </div>
    </div>
  );
}
