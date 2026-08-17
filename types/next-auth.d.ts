import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      founderEmailVerified: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    founderEmailVerified?: boolean;
  }
}
