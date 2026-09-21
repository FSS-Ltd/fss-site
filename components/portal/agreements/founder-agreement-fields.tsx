import { Notice, PortalCard } from "@/components/portal/ui";

export const agreementBuilderSteps = [
  "link",
  "scope",
  "fees",
  "people",
  "document",
  "review",
] as const;

export type AgreementBuilderStep = (typeof agreementBuilderSteps)[number];

const stepContent: Record<
  AgreementBuilderStep,
  Readonly<{ description: string; title: string }>
> = {
  document: {
    description:
      "The signing source is generated from the validated agreement revision. Its fingerprint is created when the signing request is prepared.",
    title: "Prepare the agreement document",
  },
  fees: {
    description:
      "Set structured fee lines, payment schedule and tax treatment from the approved commercial terms.",
    title: "Fees, schedule and terms",
  },
  link: {
    description:
      "Start from reviewed work so the agreement remains linked to an approved engagement.",
    title: "Link the right work",
  },
  people: {
    description:
      "Name the billing contact and required signers. A signer does not gain portal ownership or billing access from this selection.",
    title: "People and responsibilities",
  },
  review: {
    description:
      "Check the generated terms, version and signer list before opening the exact document for signing.",
    title: "Review before sending",
  },
  scope: {
    description:
      "Make the agreed outcome, responsibilities, support and boundaries clear before setting fees.",
    title: "Define the work",
  },
};

export function FounderAgreementFields({
  step,
}: Readonly<{
  step: AgreementBuilderStep;
}>): React.JSX.Element {
  const content = stepContent[step];
  return (
    <>
      <PortalCard description={content.description} title={content.title}>
        <p>
          The agreement form below uses the existing validated command path.
        </p>
      </PortalCard>
      {step === "fees" ? (
        <Notice tone="warning">
          <strong>Payment amounts must reconcile.</strong>
          <p>
            The required deposit and every installment must allocate the exact
            one-off total. The server validates pence values before saving.
          </p>
        </Notice>
      ) : null}
      {step === "review" ? (
        <Notice tone="info">
          <strong>Approval is not signature.</strong>
          <p>
            Opening a signing request preserves the exact reviewed revision. It
            does not create a signed agreement until retained evidence is
            complete.
          </p>
        </Notice>
      ) : null}
    </>
  );
}
