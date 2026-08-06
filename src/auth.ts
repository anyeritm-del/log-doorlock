import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";
import { getUser } from "./lib/registry";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      if (allowedDomain && !email.endsWith(`@${allowedDomain.toLowerCase()}`)) {
        return false;
      }

      // Only emails already registered in the admin sheet's Users tab may sign in.
      const registered = await getUser(email);
      return Boolean(registered);
    },
    async jwt({ token, user }) {
      // Only hit the registry sheet on sign-in (user present) or if this token has
      // never been populated. Every other request reuses the role/hotelIds already
      // embedded in the JWT, avoiding a Sheets call per page load.
      const needsLookup = Boolean(user) || token.role === undefined;
      const email = (user?.email ?? token.email)?.toLowerCase();
      if (needsLookup && email) {
        const registered = await getUser(email);
        if (registered) {
          token.role = registered.role;
          token.hotelIds = registered.hotelIds;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role ?? "staff";
        session.user.hotelIds = token.hotelIds ?? [];
      }
      return session;
    },
  },
});
