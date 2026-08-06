import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the auth config. Used directly by middleware.ts, which runs on
 * the Edge runtime and cannot import googleapis (Node-only crypto). Route-level and
 * page-level authorization instead read the role/hotelIds already embedded in the JWT
 * by auth.ts's callbacks, so no Sheets lookup is needed at request time.
 */
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");
      if (isLoginPage) return true;
      return Boolean(auth?.user);
    },
  },
};
