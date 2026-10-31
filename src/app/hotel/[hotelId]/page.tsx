import Link from "next/link";
import { requireHotelAccess } from "@/lib/authz";
import { listFloorNames } from "@/lib/rooms";
import {
  EmptyState,
  PageHeader,
  SectionTitle,
  buttonPrimary,
  buttonSecondary,
  cardClass,
  linkCardClass,
} from "@/components/ui";
import { CreateFloorForm } from "./CreateFloorForm";

export default async function HotelFloorsPage({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  const hotel = await requireHotelAccess(hotelId);
  const floors = await listFloorNames(hotel.sheetId);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={hotel.hotelName}
        subtitle={hotel.brand}
        breadcrumbs={[{ label: "Hotels", href: "/" }, { label: hotel.hotelName }]}
        actions={
          <>
            <Link href={`/hotel/${hotelId}/report`} className={buttonSecondary}>
              Security report
            </Link>
            <Link href={`/hotel/${hotelId}/upload`} className={buttonPrimary}>
              Upload log file
            </Link>
          </>
        }
      />

      <section className="flex flex-col gap-4">
        <SectionTitle count={floors.length}>Floors</SectionTitle>
        {floors.length === 0 && <EmptyState>No floors yet. Add the first one below.</EmptyState>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {floors.map((floor) => (
            <li key={floor}>
              <Link
                href={`/hotel/${hotelId}/floor/${encodeURIComponent(floor)}`}
                className={`${linkCardClass} p-5 text-center font-bold text-brand`}
              >
                {floor}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${cardClass} p-5`}>
        <CreateFloorForm hotelId={hotelId} />
      </section>
    </div>
  );
}
