import Link from "next/link";
import { auth, signOut } from "@/auth";

export async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-gray-900">
          Door Lock Logs
        </Link>
        <nav className="flex items-center gap-4 text-sm text-gray-600">
          {session.user.role === "admin" && (
            <>
              <Link href="/admin/hotels" className="hover:text-gray-900">
                Hotels
              </Link>
              <Link href="/admin/users" className="hover:text-gray-900">
                Users
              </Link>
            </>
          )}
          <span className="text-gray-400">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="hover:text-gray-900">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
