import { z } from "zod";
import type { BillingScope } from "./domain-types";
export function validateBillingScope(scope: BillingScope): void {
  z.strictObject({
    organisationId: z.uuid(),
    accountId: z.string().regex(/^acct_[A-Za-z0-9]+$/),
    mode: z.enum(["test", "live"]),
  }).parse(scope);
}
