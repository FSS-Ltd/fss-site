import { createHash } from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";

import { readGrowthServerEnv } from "../config/env";
import { isAllowedFounderProfile } from "./policy";
import { readVerifiedClerkEmail } from "../../operations/auth/verified-user";

export type FounderSession = {
  email: string;
  actorId: string;
};

type AuthSession = {
  user?: {
    email?: string | null;
    founderEmailVerified?: boolean;
  };
} | null;

export class FounderAuthorizationError extends Error {
  readonly code = "FOUNDER_AUTHORIZATION_REQUIRED" as const;

  constructor() {
    super("Founder authorization is required.");
    this.name = "FounderAuthorizationError";
  }
}

export function resolveFounderSession(
  session: AuthSession,
  ownerEmail: string,
): FounderSession {
  if (
    !isAllowedFounderProfile(
      {
        email: session?.user?.email,
        emailVerified: session?.user?.founderEmailVerified,
      },
      ownerEmail,
    )
  ) {
    throw new FounderAuthorizationError();
  }

  const email = ownerEmail.trim().toLowerCase();
  const actorId = createHash("sha256").update(email).digest("hex");

  return { email, actorId };
}

export async function requireFounder(): Promise<FounderSession> {
  const session = await auth();
  if (!session.userId) throw new FounderAuthorizationError();
  const user = await currentUser();
  const email = user && user.id === session.userId ? readVerifiedClerkEmail(user) : null;
  return resolveFounderSession(
    { user: { email, founderEmailVerified: Boolean(email) } },
    readGrowthServerEnv().ownerEmail,
  );
}
