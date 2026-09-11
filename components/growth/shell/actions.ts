"use server";

import { signOut } from "@/auth";
import { GROWTH_LOGIN_PATH } from "@/lib/growth/auth/routing";

export async function signOutFounder(): Promise<void> {
  await signOut({ redirectTo: GROWTH_LOGIN_PATH });
}
