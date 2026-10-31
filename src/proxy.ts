import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js's build-time check for a valid proxy export only recognizes a plain
// `export const proxy = ...` identifier, not a destructured export — so this
// can't be written as `export const { auth: proxy } = NextAuth(authConfig)`.
const { auth } = NextAuth(authConfig);
export const proxy = auth;

// brand/ holds public logo assets that the login page shows before the user is signed in.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|brand/).*)"],
};
