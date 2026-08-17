"use server";

import { cookies } from "next/headers";

import { signIn } from "@/auth";
import {
  GROWTH_CALLBACK_COOKIE,
  deleteGrowthCallbackCookie,
  resolveGrowthCallbackPath,
} from "@/lib/growth/auth/routing";

export async function continueWithGoogle(): Promise<void> {
  const cookieStore = await cookies();
  const callbackUrl = resolveGrowthCallbackPath(
    cookieStore.get(GROWTH_CALLBACK_COOKIE)?.value,
  );
  deleteGrowthCallbackCookie(cookieStore);

  await signIn("google", { redirectTo: callbackUrl });
}
