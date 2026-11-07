"use client";

import { usePathname, useRouter } from "next/navigation";
import { inputClass, labelClass } from "@/components/ui";
import type { MonthOption } from "@/lib/months";

/** Picks the month shown on the room page; the choice lives in the URL (?month=2026-10). */
export function MonthSelect({
  options,
  value,
  totalCount,
}: {
  options: MonthOption[];
  value: string;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className={`${labelClass} max-w-xs`}>
      Month
      <select
        className={inputClass}
        value={value}
        onChange={(e) => {
          const month = e.target.value;
          router.push(month ? `${pathname}?month=${encodeURIComponent(month)}` : pathname);
        }}
      >
        <option value="">All months ({totalCount})</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
    </label>
  );
}
