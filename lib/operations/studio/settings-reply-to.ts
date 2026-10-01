import { z } from "zod";

/** Nonsecret deployment allowlist. Never inferred from sender credentials. */
export function approvedStudioReplyToAddresses(
  env: Record<string, string | undefined> = process.env,
): readonly string[] {
  const values = (env.OPERATIONS_STUDIO_APPROVED_REPLY_TO_ADDRESSES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [
    ...new Set(
      values.filter((value) => z.email().max(254).safeParse(value).success),
    ),
  ];
}
