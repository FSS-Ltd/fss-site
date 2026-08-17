import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import type { GrowthServerEnv } from "../config/env";
import { isAllowedFounderProfile } from "./policy";

export const GROWTH_GOOGLE_AUTH_SCOPES = "openid email profile" as const;

type GrowthAuthEnv = Pick<
  GrowthServerEnv,
  "authSecret" | "googleAuthClientId" | "googleAuthClientSecret" | "ownerEmail"
>;

export function createGrowthAuthConfig(env: GrowthAuthEnv): NextAuthConfig {
  return {
    secret: env.authSecret,
    session: {
      strategy: "jwt",
      maxAge: 8 * 60 * 60,
    },
    providers: [
      Google({
        clientId: env.googleAuthClientId,
        clientSecret: env.googleAuthClientSecret,
        authorization: {
          params: {
            scope: GROWTH_GOOGLE_AUTH_SCOPES,
            prompt: "select_account",
            hd: "faithfulsoftware.dev",
          },
        },
      }),
    ],
    callbacks: {
      async signIn({ profile }) {
        return isAllowedFounderProfile(
          {
            email: profile?.email,
            emailVerified: profile?.email_verified === true,
          },
          env.ownerEmail,
        );
      },
      async jwt({ token, profile, trigger }) {
        if (trigger === "signIn") {
          token.founderEmailVerified = profile?.email_verified === true;
        }

        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.founderEmailVerified =
            token.founderEmailVerified === true;
        }

        return session;
      },
    },
  };
}
