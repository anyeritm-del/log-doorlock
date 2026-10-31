import Link from "next/link";
import type { ReactNode } from "react";

// Shared Archipelago-themed styles. Keep page markup using these instead of repeating
// colour/spacing classes, so the look stays consistent and is changed in one place.

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-brand shadow-sm transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export const inputClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none";

export const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-gray-700";

export const cardClass = "rounded-xl border border-gray-200 bg-white shadow-sm";

export const linkCardClass = `${cardClass} block transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md`;

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-brand-grey">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-brand hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-gray-600">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-brand">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-brand uppercase">
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium tracking-normal text-brand">
          {count}
        </span>
      )}
    </h2>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </p>
  );
}

const alertStyles = {
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
} as const;

export function Alert({
  tone,
  children,
}: {
  tone: keyof typeof alertStyles;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${alertStyles[tone]}`}
    >
      {children}
    </div>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-brand text-left text-white">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-medium tracking-wider whitespace-nowrap uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export const tdClass = "px-4 py-2.5 whitespace-nowrap text-gray-700";
export const trClass = "transition-colors hover:bg-brand-soft/50";
