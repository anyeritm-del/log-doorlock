import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/registry";

declare module "next-auth" {
  interface Session {
    user: {
      role: UserRole;
      hotelIds: string[] | "ALL";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: UserRole;
    hotelIds?: string[] | "ALL";
  }
}
