"use client";

import { PortalTextarea } from "@/components/portal/ui";
import {
  AgreementBuilderGroupForm,
  useAgreementBuilderGroups,
} from "./agreement-builder-groups";
import {
  type BuilderStepProps,
  mergeContent,
  textValue,
} from "./agreement-builder-step-support";

export function AgreementBuilderScopeStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const flow = useAgreementBuilderGroups(3);

  async function save(step: "scope" | "link" | "fees"): Promise<void> {
    const data = flow.read();
    if (data)
      await onSave(
        step,
        mergeContent(content, {
          ...agreement,
          goals: textValue(data, "goals"),
          scope: textValue(data, "scope"),
          terms: textValue(data, "terms"),
          responsibilities: textValue(data, "responsibilities"),
          support: textValue(data, "support"),
        }),
      );
  }

  return (
    <AgreementBuilderGroupForm
      flow={flow}
      pending={pending}
      backLabel="Back to work"
      continueLabel="Continue to fees"
      onBack={() => void save("link")}
      onContinue={() => void save("fees")}
      onSave={() => void save("scope")}
      groups={[
        {
          title: "Define the work",
          description:
            "Start with the outcome, then describe what you’ll deliver.",
          children: (
            <>
              <PortalTextarea
                label="Client goals"
                name="goals"
                defaultValue={agreement.goals ?? ""}
                placeholder="What should be easier or better for your client?"
                maxLength={4000}
                required
              />
              <PortalTextarea
                label="Included deliverables"
                name="scope"
                defaultValue={agreement.scope ?? ""}
                placeholder="Describe the work included in this agreement"
                maxLength={4000}
                required
              />
            </>
          ),
        },
        {
          title: "Set clear boundaries",
          description:
            "Explain exclusions, assumptions and how the work will be accepted.",
          children: (
            <PortalTextarea
              label="Not included, assumptions & acceptance criteria"
              labelVisibility="hidden"
              aria-labelledby={flow.headingId(1)}
              name="terms"
              defaultValue={agreement.terms ?? ""}
              maxLength={4000}
              placeholder="What sits outside the scope, and what counts as complete?"
              required
            />
          ),
        },
        {
          title: "Agree responsibilities and support",
          description: "Be clear about what each side will provide.",
          children: (
            <>
              <PortalTextarea
                label="Client responsibilities"
                name="responsibilities"
                defaultValue={agreement.responsibilities ?? ""}
                maxLength={4000}
                placeholder="For example, approved content and one reviewer"
                required
              />
              <PortalTextarea
                label="Support expectations"
                name="support"
                defaultValue={agreement.support ?? ""}
                maxLength={4000}
                placeholder="Describe support included after delivery"
                required
              />
            </>
          ),
        },
      ]}
    />
  );
}
