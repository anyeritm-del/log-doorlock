import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto mt-24 flex max-w-sm flex-col items-center gap-6 text-center">
      <h1 className="text-xl font-semibold">Door Lock Logs</h1>
      <p className="text-sm text-gray-600">
        Sign in with your company Google account to view hotel door lock access logs.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
