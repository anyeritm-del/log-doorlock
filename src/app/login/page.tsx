import Image from "next/image";
import { signIn } from "@/auth";
import { Alert, buttonPrimary } from "@/components/ui";

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
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-brand/10 ring-1 ring-brand/10">
          <div className="relative bg-brand px-8 pt-10 pb-8 text-center">
            <Image
              src="/brand/archipelago-logo-white.webp"
              alt="Archipelago"
              width={567}
              height={109}
              priority
              className="mx-auto h-auto w-52"
            />
            <div className="mx-auto mt-6 h-px w-12 bg-brand-grey" />
            <p className="mt-4 text-xs font-medium tracking-[0.25em] text-white/70 uppercase">
              Door Lock Logs
            </p>
          </div>

          <div className="px-8 py-8">
            <h1 className="text-xl font-bold text-brand">Welcome back</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Sign in with your company Google account to review hotel door lock access logs.
            </p>

            {errorMessage && (
              <div className="mt-6">
                <Alert tone="error">{errorMessage}</Alert>
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
                className={`${buttonPrimary} w-full gap-3 py-3`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-white">
                  <GoogleIcon />
                </span>
                Sign in with Google
              </button>
            </form>

            <p className="mt-6 border-t border-gray-100 pt-5 text-xs leading-5 text-brand-grey">
              Access is limited to registered Archipelago staff. Activity in this app may be
              audited.
            </p>
          </div>
        </div>

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
