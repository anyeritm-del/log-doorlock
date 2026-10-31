import Image from "next/image";
import { Zen_Kaku_Gothic_New } from "next/font/google";
import { signIn } from "@/auth";

// Archipelago International brand: navy #00215B, grey #939598, Zen Kaku Gothic New
// (taken from archipelagohotels.com). Logo is the white version used on their navy header.
const brandFont = Zen_Kaku_Gothic_New({ weight: ["400", "500", "700"], subsets: ["latin"] });

// Auth.js redirects back to the sign-in page with ?error=<code> when sign-in fails.
// AccessDenied is what our signIn callback produces for unregistered or off-domain emails.
const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied:
    "Your account is not authorised to use this app. Ask an admin to add your email to the user list.",
  Configuration: "Sign-in is temporarily unavailable. Please try again later or contact IT.",
};
const DEFAULT_ERROR = "Sign-in failed. Please try again.";

// Only allow same-site relative paths, so callbackUrl can't redirect users to another site.
function safeRedirect(callbackUrl: string | string[] | undefined): string {
  if (typeof callbackUrl !== "string") return "/";
  try {
    const url = new URL(callbackUrl, "http://localhost");
    if (url.origin !== "http://localhost") return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR) : undefined;
  const redirectTo = safeRedirect(params.callbackUrl);

  return (
    <div
      className={`${brandFont.className} flex min-h-[calc(100vh-3rem)] items-center justify-center`}
    >
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-[#00215B]/10 ring-1 ring-[#00215B]/10">
          <div className="relative bg-[#00215B] px-8 pt-10 pb-8 text-center">
            <Image
              src="/brand/archipelago-logo-white.webp"
              alt="Archipelago"
              width={567}
              height={109}
              priority
              className="mx-auto h-auto w-52"
            />
            <div className="mx-auto mt-6 h-px w-12 bg-[#939598]" />
            <p className="mt-4 text-xs font-medium tracking-[0.25em] text-white/70 uppercase">
              Door Lock Logs
            </p>
          </div>

          <div className="px-8 py-8">
            <h1 className="text-xl font-bold text-[#00215B]">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Sign in with your company Google account to review hotel door lock access logs.
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <form
              className="mt-8"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-md bg-[#00215B] px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a2f75] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00215B]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-white">
                  <GoogleIcon />
                </span>
                Sign in with Google
              </button>
            </form>

            <p className="mt-6 border-t border-gray-100 pt-5 text-xs leading-5 text-[#939598]">
              Access is limited to registered Archipelago staff. Activity in this app may be
              audited.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#939598]">
          © {new Date().getFullYear()} Archipelago International · Built by Sentinel Tech
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-4 w-4">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
