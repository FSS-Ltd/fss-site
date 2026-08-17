import NextAuth from "next-auth";

import { createGrowthAuthConfig } from "@/lib/growth/auth/config";
import { readGrowthServerEnv } from "@/lib/growth/config/env";

export const { handlers, auth, signIn, signOut } = NextAuth(() =>
  createGrowthAuthConfig(readGrowthServerEnv()),
);
