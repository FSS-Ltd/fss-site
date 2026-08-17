import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import Google from "next-auth/providers/google";

import type { GrowthServerEnv } from "../config/env";
import { isAllowedFounderProfile } from "./policy";
import {
  GROWTH_CALLBACK_COOKIE,
  GROWTH_COOKIE_PATH,
  GROWTH_LOGIN_PATH,
  isGrowthLoginPath,
  resolveGrowthCallbackPath,
} from "./routing";

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
    pages: {
      signIn: GROWTH_LOGIN_PATH,
      error: GROWTH_LOGIN_PATH,
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
      authorized({ auth, request }) {
        const { pathname, search } = request.nextUrl;

        if (
          isGrowthLoginPath(pathname) ||
          isAllowedFounderProfile(
            {
              email: auth?.user?.email,
              emailVerified: auth?.user?.founderEmailVerified,
            },
            env.ownerEmail,
          )
        ) {
          return true;
        }

        const loginUrl = new URL(GROWTH_LOGIN_PATH, request.nextUrl);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set({
          name: GROWTH_CALLBACK_COOKIE,
          value: resolveGrowthCallbackPath(`${pathname}${search}`),
          httpOnly: true,
          maxAge: 10 * 60,
          path: GROWTH_COOKIE_PATH,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
        });
        return response;
      },
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
