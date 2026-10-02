"use client";

import { PortalField } from "@/components/portal/ui";
import {
  AgreementBuilderGroupForm,
  useAgreementBuilderGroups,
} from "./agreement-builder-groups";
import {
  type BuilderStepProps,
  mergeContent,
  textValue,
} from "./agreement-builder-step-support";

export function AgreementBuilderPeopleStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const flow = useAgreementBuilderGroups(1);

  async function save(step: "people" | "fees" | "document"): Promise<void> {
    const data = flow.read();
    if (data)
      await onSave(
        step,
        mergeContent(content, {
          ...agreement,
          billingContact: textValue(data, "billingContact").toLowerCase(),
          signatories: textValue(data, "signatories")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean),
        }),
      );
  }

  return (
    <AgreementBuilderGroupForm
      flow={flow}
      pending={pending}
      backLabel="Back to fees"
      continueLabel="Continue to document"
      onBack={() => void save("fees")}
      onContinue={() => void save("document")}
      onSave={() => void save("people")}
      groups={[
        {
          title: "Who signs and pays?",
          description:
            "Choose the billing contact and everyone who needs to sign.",
          children: (
            <>
              <PortalField label="Billing contact email" required>
                <input
                  name="billingContact"
                  type="email"
                  defaultValue={agreement.billingContact ?? ""}
                  autoComplete="email"
                />
              </PortalField>
              <PortalField
                label="Required client signer emails"
                hint="Separate email addresses with commas. Signing does not grant portal or billing access."
                required
              >
                <input
                  name="signatories"
                  type="email"
                  multiple
                  defaultValue={agreement.signatories?.join(", ") ?? ""}
                />
              </PortalField>
            </>
          ),
        },
      ]}
    />
  );
}
