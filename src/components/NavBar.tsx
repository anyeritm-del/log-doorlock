import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";

export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const email = session.user.email ?? "";
  const initial = email.charAt(0).toUpperCase();

  return (
    <header className="bg-brand text-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/archipelago-logo-white.webp"
            alt="Archipelago"
            width={567}
            height={109}
            priority
            className="h-6 w-auto"
          />
          <span className="hidden h-5 w-px bg-white/30 sm:block" aria-hidden="true" />
          <span className="hidden text-sm font-medium tracking-wide text-white/90 sm:block">
            Door Lock Logs
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {session.user.role === "admin" && (
            <>
              <Link
                href="/admin/hotels"
                className="rounded-md px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                Hotels
              </Link>
              <Link
                href="/admin/users"
                className="rounded-md px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                Users
              </Link>
              <span className="mx-2 h-5 w-px bg-white/30" aria-hidden="true" />
            </>
          )}
          <span
            title={email}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold"
          >
            {initial}
          </span>
          <span className="ml-2 hidden max-w-48 truncate text-white/70 md:block">{email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="ml-2 rounded-md border border-white/30 px-3 py-1.5 text-white/90 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
