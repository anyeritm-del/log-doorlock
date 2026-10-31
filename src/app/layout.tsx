import type { Metadata } from "next";
import { Geist_Mono, Zen_Kaku_Gothic_New } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

// Archipelago International's brand typeface (as used on archipelagohotels.com).
const brandFont = Zen_Kaku_Gothic_New({
  variable: "--font-brand",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Door Lock Logs · Archipelago",
  description: "Multi-hotel door lock access log viewer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${brandFont.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col text-gray-900">
        <NavBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-brand-grey sm:flex-row sm:justify-between sm:px-6">
            <span>© {new Date().getFullYear()} Archipelago International</span>
            <span>Door Lock Logs · Built by Sentinel Tech</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
