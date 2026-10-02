"use client";

import { useRef, useState } from "react";
import {
  Notice,
  PortalActionLink,
  PortalButton,
  PortalField,
} from "@/components/portal/ui";
import {
  AgreementBuilderGroupForm,
  useAgreementBuilderGroups,
} from "./agreement-builder-groups";
import {
  type BuilderStepProps,
  mergeContent,
  textValue,
} from "./agreement-builder-step-support";
import type { AgreementEngagementChoice } from "./agreement-builder-step-panel";
import styles from "./agreement-builder.module.css";

export function AgreementBuilderLinkStep({
  agreement,
  content,
  engagements,
  engagementHref,
  onBeginEngagement,
  onSave,
  pending,
}: BuilderStepProps &
  Readonly<{
    engagements: readonly AgreementEngagementChoice[];
    engagementHref: string;
  }>): React.JSX.Element {
  const flow = useAgreementBuilderGroups(2);
  const [engagementId, setEngagementId] = useState(content.engagementId ?? "");
  const [query, setQuery] = useState("");
  const exploringWithArrows = useRef(false);
  const visibleEngagements = engagements.filter((engagement) =>
    engagement.name
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const hasEngagements = engagements.length > 0;

  async function save(step: "link" | "scope"): Promise<void> {
    const data = flow.read();
    if (data)
      await onSave(
        step,
        mergeContent(
          content,
          {
            ...agreement,
            title: textValue(data, "title"),
          },
          engagementId,
        ),
      );
  }

  async function beginEngagement(): Promise<void> {
    if (!onBeginEngagement || !flow.formRef.current) return;
    const title = textValue(new FormData(flow.formRef.current), "title");
    await onBeginEngagement(
      mergeContent(content, {
        ...agreement,
        ...(title ? { title } : {}),
      }),
    );
  }

  return (
    <AgreementBuilderGroupForm
      flow={flow}
      pending={pending}
      continueLabel="Continue to scope"
      continueDisabled={!hasEngagements}
      continueDisabledReason="Link reviewed work before defining the agreement scope."
      onContinue={() => void save("scope")}
      onSave={() => void save("link")}
      groups={[
        {
          title: "Link the right work",
          description: "Choose the reviewed work this agreement covers.",
          children: (
            <>
              {engagements.length > 5 ? (
                <PortalField
                  label="Find an engagement"
                  labelVisibility="hidden"
                >
                  <input
                    type="search"
                    placeholder="Search reviewed work"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </PortalField>
              ) : null}
              {hasEngagements ? (
                <fieldset className={styles.workChoices}>
                  <legend className={styles.visuallyHidden}>
                    Reviewed engagement
                  </legend>
                  {engagements.map((engagement) => (
                    <label
                      className={styles.workChoice}
                      key={engagement.id}
                      hidden={!visibleEngagements.includes(engagement)}
                    >
                      <input
                        type="radio"
                        name="engagementId"
                        value={engagement.id}
                        required
                        checked={engagementId === engagement.id}
                        onChange={() => setEngagementId(engagement.id)}
                        onPointerDown={() => {
                          exploringWithArrows.current = false;
                        }}
                        onClick={() => {
                          if (!exploringWithArrows.current) flow.show(1);
                        }}
                        onKeyUp={() => {
                          exploringWithArrows.current = false;
                        }}
                        onKeyDown={(event) => {
                          exploringWithArrows.current =
                            event.key.startsWith("Arrow");
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setEngagementId(engagement.id);
                            flow.show(1);
                          }
                        }}
                      />
                      <span>
                        {engagement.name}
                        <small>Reviewed &amp; linked</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <Notice
                  tone="warning"
                  action={
                    onBeginEngagement ? (
                      <PortalButton
                        type="button"
                        disabled={pending}
                        onClick={() => void beginEngagement()}
                      >
                        Create engagement
                      </PortalButton>
                    ) : (
                      <PortalActionLink href={engagementHref}>
                        Create engagement
                      </PortalActionLink>
                    )
                  }
                >
                  <strong>No engagement is linked.</strong>
                  <p>
                    Your draft stays saved while you create or link the right
                    work.
                  </p>
                </Notice>
              )}
              {hasEngagements && visibleEngagements.length === 0 ? (
                <p role="status">No reviewed engagement matches that search.</p>
              ) : null}
            </>
          ),
        },
        {
          title: "Give this agreement a name",
          description: "Use a name your client will recognise.",
          children: (
            <PortalField
              label="Agreement title"
              labelVisibility="hidden"
              required
            >
              <input
                aria-labelledby={flow.headingId(1)}
                name="title"
                defaultValue={agreement.title ?? ""}
                maxLength={200}
                placeholder="For example, Website and booking experience"
              />
            </PortalField>
          ),
        },
      ]}
    />
  );
}
