import { z } from "zod";
import type { AgreementDraft } from "../agreements/types";
import { dateOnly, money } from "../agreements/validation";
import type { ActivationEvidence } from "./types";
export const activationSchema = z.strictObject({
  effectiveDate: dateOnly,
  assetsReady: z.boolean(),
  deposit: z
    .strictObject({
      amountPence: money,
      verifiedDate: dateOnly,
      reference: z.string().trim().min(1).max(200),
    })
    .nullable(),
});
export function validateActivation(
  draft: AgreementDraft,
  signed: boolean,
  raw: unknown,
  today: string,
  lineNumber = 1,
): ActivationEvidence {
  const evidence = activationSchema.parse(raw);
  if (!signed)
    throw new Error("A signed revision is required before activation.");
  if (evidence.effectiveDate > today)
    throw new Error("Activate when the effective start date arrives.");
  const line = draft.lines[lineNumber - 1];
  if (!line) throw new Error("Service line was not found.");
  if (evidence.effectiveDate < line.startDate)
    throw new Error(
      "The effective date cannot precede the contractual start date.",
    );
  if (line.endDate && evidence.effectiveDate > line.endDate)
    throw new Error("The effective date cannot follow a contractual end date.");
  if (draft.assetsRequired && !evidence.assetsReady)
    throw new Error("Confirm the required client assets are ready.");
  if (
    BigInt(draft.requiredDepositPence) > BigInt(0) &&
    (!evidence.deposit ||
      BigInt(evidence.deposit.amountPence) < BigInt(draft.requiredDepositPence))
  )
    throw new Error("Verify the full required deposit before activation.");
  if (
    evidence.deposit &&
    (evidence.deposit.verifiedDate > today ||
      evidence.deposit.verifiedDate > evidence.effectiveDate)
  )
    throw new Error(
      "The deposit verification date must be on or before the effective date.",
    );
  return evidence;
}
