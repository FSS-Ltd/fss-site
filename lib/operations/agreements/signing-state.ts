import type { SigningApproval } from "./signing-types";

export function allRequiredSignaturesRecorded(
  approval: Pick<SigningApproval, "requiredSigners" | "signatures">,
): boolean {
  return (
    approval.requiredSigners.length > 0 &&
    approval.requiredSigners.every((requiredSigner) =>
      approval.signatures.some(
        (signature) => signature.email === requiredSigner,
      ),
    )
  );
}
