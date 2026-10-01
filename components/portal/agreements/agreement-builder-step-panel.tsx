"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Link2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  Notice,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
  PortalTextarea,
  StatusBadge,
} from "@/components/portal/ui";
import type {
  AgreementBuilderDraftContent,
  AgreementBuilderStep,
} from "@/lib/operations/agreements/builder-draft-schema";
import { totalLinePence } from "@/lib/operations/agreements/validation";
import { AgreementBuilderFeesStep } from "./agreement-builder-fees-step";
import {
  BuilderSection,
  type BuilderStepProps,
  FormActions,
  formatGbp,
  mergeContent,
  textValue,
} from "./agreement-builder-step-support";
import styles from "./agreements.module.css";

export type AgreementEngagementChoice = Readonly<{ id: string; name: string }>;

export const agreementBuilderSteps = [
  "link",
  "scope",
  "fees",
  "people",
  "document",
  "review",
] as const satisfies readonly AgreementBuilderStep[];

const stepDetails: Record<
  AgreementBuilderStep,
  Readonly<{ label: string; summary: string }>
> = {
  document: { label: "Document", summary: "Document & evidence" },
  fees: { label: "Fees", summary: "Fees & terms" },
  link: { label: "Link work", summary: "Client & engagement" },
  people: { label: "People", summary: "Contacts & signers" },
  review: { label: "Review", summary: "Preview & approve" },
  scope: { label: "Scope", summary: "Scope & outcomes" },
};

export function agreementBuilderStepDetail(
  step: AgreementBuilderStep,
): Readonly<{ label: string; summary: string }> {
  return stepDetails[step];
}

function LinkStep({
  agreement,
  content,
  engagements,
  engagementHref,
  onBeginEngagement,
  onSave,
  organisationName,
  pending,
}: BuilderStepProps &
  Readonly<{
    engagements: readonly AgreementEngagementChoice[];
    engagementHref: string;
    onBeginEngagement?: (
      content: AgreementBuilderDraftContent,
    ) => Promise<void>;
    organisationName: string;
  }>): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const visibleEngagements = engagements.filter((engagement) =>
    engagement.name
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );

  function contentFromForm(): AgreementBuilderDraftContent | null {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return null;
    const data = new FormData(form);
    const title = textValue(data, "title");
    const engagementId = textValue(data, "engagementId");
    return mergeContent(content, { ...agreement, title }, engagementId);
  }

  async function save(step: AgreementBuilderStep): Promise<void> {
    const nextContent = contentFromForm();
    if (nextContent) await onSave(step, nextContent);
  }

  const hasEngagements = engagements.length > 0;

  return (
    <BuilderSection icon={<Link2 size={20} />} title="Link the right work">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("scope");
        }}
        ref={formRef}
      >
        <div className={styles.fieldGrid}>
          <PortalField label="Client" required>
            <input defaultValue={organisationName} readOnly />
          </PortalField>
          {hasEngagements ? (
            <PortalSelect
              defaultValue={content.engagementId ?? ""}
              hint="Only reviewed work already linked to this client can become an agreement."
              label="Engagement"
              name="engagementId"
              required
            >
              <option value="">Choose reviewed work</option>
              {visibleEngagements.map((engagement) => (
                <option key={engagement.id} value={engagement.id}>
                  {engagement.name}
                </option>
              ))}
            </PortalSelect>
          ) : null}
          <PortalField label="Agreement title" required>
            <input
              defaultValue={agreement.title ?? ""}
              maxLength={200}
              name="title"
              required
            />
          </PortalField>
          <PortalField label="Find an engagement">
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by project or engagement name"
              type="search"
              value={query}
            />
          </PortalField>
        </div>
        {hasEngagements && visibleEngagements.length === 0 ? (
          <Notice tone="info">
            <strong>No reviewed engagement matches that search.</strong>
            <p>Clear the search or create reviewed work for this client.</p>
          </Notice>
        ) : null}
        {hasEngagements ? (
          <PortalCard className={styles.relatedWork} title="Related work">
            <ul className={styles.schedule}>
              {visibleEngagements.map((engagement) => (
                <li key={engagement.id}>
                  <span>{engagement.name}</span>
                  <StatusBadge status="success">
                    Reviewed &amp; linked
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </PortalCard>
        ) : (
          <Notice
            action={
              onBeginEngagement ? (
                <PortalButton
                  disabled={pending}
                  onClick={() => {
                    const nextContent = contentFromForm();
                    if (nextContent) void onBeginEngagement(nextContent);
                  }}
                  type="button"
                >
                  Create engagement
                </PortalButton>
              ) : (
                <PortalActionLink href={engagementHref}>
                  Create engagement
                </PortalActionLink>
              )
            }
            tone="warning"
          >
            <strong>No engagement is linked.</strong>
            <p>
              An engagement connects this agreement to reviewed work. Your draft
              stays saved while you create or link the right work.
            </p>
          </Notice>
        )}
        <FormActions
          continueDisabled={!hasEngagements}
          continueDisabledReason="Link reviewed work before defining the agreement scope."
          continueLabel="Continue to scope"
          onSave={() => void save("link")}
          pending={pending}
        />
      </form>
    </BuilderSection>
  );
}

function ScopeStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);

  function contentFromForm(): AgreementBuilderDraftContent | null {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return null;
    const data = new FormData(form);
    return mergeContent(content, {
      ...agreement,
      goals: textValue(data, "goals"),
      responsibilities: textValue(data, "responsibilities"),
      scope: textValue(data, "scope"),
      support: textValue(data, "support"),
      terms: textValue(data, "terms"),
    });
  }

  async function save(step: AgreementBuilderStep): Promise<void> {
    const nextContent = contentFromForm();
    if (nextContent) await onSave(step, nextContent);
  }

  return (
    <BuilderSection icon={<FileText size={20} />} title="Define the work">
      <p className={styles.muted}>
        Be clear about outcomes, inclusions and boundaries before agreeing fees.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("fees");
        }}
        ref={formRef}
      >
        <div className={styles.builderFormFields}>
          <PortalTextarea
            defaultValue={agreement.goals ?? ""}
            label="Client goals"
            name="goals"
            required
          />
          <PortalTextarea
            defaultValue={agreement.scope ?? ""}
            label="Included deliverables"
            name="scope"
            required
          />
          <PortalTextarea
            defaultValue={agreement.terms ?? ""}
            hint="State exclusions, assumptions and acceptance criteria together."
            label="Not included, assumptions & acceptance criteria"
            name="terms"
            required
          />
          <PortalTextarea
            defaultValue={agreement.responsibilities ?? ""}
            label="Client responsibilities"
            name="responsibilities"
            required
          />
          <PortalTextarea
            defaultValue={agreement.support ?? ""}
            label="Support expectations"
            name="support"
            required
          />
        </div>
        <FormActions
          backLabel="Back to work"
          continueLabel="Continue to fees"
          onBack={() => void save("link")}
          onSave={() => void save("scope")}
          pending={pending}
        />
      </form>
    </BuilderSection>
  );
}

function PeopleStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);

  function contentFromForm(): AgreementBuilderDraftContent | null {
    const form = formRef.current;
    if (!form || !form.reportValidity()) return null;
    const data = new FormData(form);
    const signatories = textValue(data, "signatories")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    return mergeContent(content, {
      ...agreement,
      billingContact: textValue(data, "billingContact").toLowerCase(),
      responsibilities: textValue(data, "responsibilities"),
      signatories,
    });
  }

  async function save(step: AgreementBuilderStep): Promise<void> {
    const nextContent = contentFromForm();
    if (nextContent) await onSave(step, nextContent);
  }

  return (
    <BuilderSection
      icon={<UsersRound size={20} />}
      title="People and responsibilities"
    >
      <p className={styles.muted}>Make it clear who signs, pays and reviews.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save("document");
        }}
        ref={formRef}
      >
        <div className={styles.builderFormFields}>
          <PortalField label="Billing contact email" required>
            <input
              defaultValue={agreement.billingContact ?? ""}
              name="billingContact"
              type="email"
            />
          </PortalField>
          <PortalField
            hint="Separate addresses with commas. Duplicate or inactive signers are rejected by the server."
            label="Required client signer emails"
            required
          >
            <input
              defaultValue={agreement.signatories?.join(", ") ?? ""}
              name="signatories"
              type="email"
              multiple
            />
          </PortalField>
          <PortalTextarea
            defaultValue={agreement.responsibilities ?? ""}
            label="Client responsibilities"
            name="responsibilities"
            required
          />
        </div>
        <Notice tone="info">
          <strong>Separate permissions.</strong>
          <p>
            Being a signer does not grant owner access, billing permissions or a
            portal invitation.
          </p>
        </Notice>
        <FormActions
          backLabel="Back to fees"
          continueLabel="Continue to document"
          onBack={() => void save("fees")}
          onSave={() => void save("people")}
          pending={pending}
        />
      </form>
    </BuilderSection>
  );
}

function DocumentStep({
  agreement,
  content,
  onSave,
  pending,
}: BuilderStepProps): React.JSX.Element {
  return (
    <BuilderSection
      icon={<ShieldCheck size={20} />}
      title="Prepare the agreement document"
    >
      <p className={styles.muted}>
        The exact version reviewed is retained before any signing request is
        prepared.
      </p>
      <PortalCard className={styles.documentPreview} tone="dark">
        <p className={styles.version}>FSS Studio / Agreement draft</p>
        <h3>{agreement.title || "Untitled agreement"}</h3>
        <p>
          Scope, fees, responsibilities and agreed terms are prepared from this
          saved draft.
        </p>
      </PortalCard>
      <Notice tone="info">
        <strong>Document fingerprint is generated server-side.</strong>
        <p>
          FSS Studio derives the SHA-256 fingerprint from immutable final
          document bytes. A browser never supplies a hash or private document
          reference.
        </p>
      </Notice>
      <div className={styles.actionRow}>
        <PortalButton
          disabled={pending}
          loading={pending}
          onClick={() => void onSave("review", content)}
          type="button"
        >
          Generate &amp; preview
          <ArrowRight aria-hidden="true" size={16} />
        </PortalButton>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("document", content)}
          type="button"
          variant="quiet"
        >
          Save draft
        </PortalButton>
      </div>
    </BuilderSection>
  );
}

function ReviewStep({
  agreement,
  content,
  draftExists,
  finalise,
  onSave,
  pending,
}: BuilderStepProps &
  Readonly<{
    draftExists: boolean;
    finalise: () => Promise<void>;
  }>): React.JSX.Element {
  const total = useMemo(() => {
    if (!agreement.lines) return "0";
    try {
      return agreement.lines
        .reduce((sum, line) => sum + BigInt(totalLinePence(line)), BigInt(0))
        .toString();
    } catch {
      return "0";
    }
  }, [agreement.lines]);

  return (
    <BuilderSection
      icon={<CheckCircle2 size={20} />}
      title="Review before sending"
    >
      <div className={styles.metrics}>
        <div>
          <p className={styles.metric}>
            {formatGbp(total, agreement.currency)}
          </p>
          <span>
            {content.commercialOffer
              ? "Priced fees before selection"
              : "Agreement total"}
          </span>
        </div>
        <div>
          <p className={styles.metric}>
            {formatGbp(agreement.requiredDepositPence, agreement.currency)}
          </p>
          <span>Initial deposit</span>
        </div>
        <div>
          <p className={styles.metric}>{agreement.signatories?.length ?? 0}</p>
          <span>Required signers</span>
        </div>
      </div>
      <PortalCard
        className={styles.documentPreview}
        title={agreement.title || "Agreement draft"}
      >
        <dl className={styles.summaryList}>
          <div>
            <dt>Client outcome</dt>
            <dd>{agreement.goals || "Needs review"}</dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{agreement.scope || "Needs review"}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>
              {formatGbp(agreement.requiredDepositPence, agreement.currency)}{" "}
              deposit, then the saved payment schedule.
            </dd>
          </div>
        </dl>
      </PortalCard>
      <PortalCard title="Readiness checks">
        <ul className={styles.checkList}>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Engagement linked</span>
            <strong>{content.engagementId ? "Ready" : "Required"}</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Fees and schedule reconcile</span>
            <strong>Validated on creation</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Signers and access reviewed</span>
            <strong>{agreement.signatories?.length ?? 0} selected</strong>
          </li>
          <li>
            <CheckCircle2 aria-hidden="true" size={18} />{" "}
            <span>Document preview reviewed</span>
            <strong>Prepared from draft</strong>
          </li>
        </ul>
      </PortalCard>
      <Notice tone="warning">
        <strong>
          {content.commercialOffer
            ? "Publish reviewed choices"
            : "Prepare signing, not signed."}
        </strong>
        <p>
          {content.commercialOffer
            ? "Publishing retains these terms and prepares exact signing documents for fixed choices. Client proposals need your approval before signing."
            : "Creating this agreement preserves the reviewed draft. Prepare its signing document on the agreement record before opening it for the required signers."}
        </p>
      </Notice>
      <div className={styles.actionRow}>
        <PortalButton
          disabled={!draftExists || pending}
          disabledReason={
            !draftExists
              ? "Save this review before creating the agreement record."
              : undefined
          }
          loading={pending}
          onClick={() => void finalise()}
          type="button"
        >
          {content.commercialOffer
            ? "Publish payment offer"
            : "Create agreement"}
        </PortalButton>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("review", content)}
          type="button"
          variant="quiet"
        >
          Save draft
        </PortalButton>
        <PortalButton
          disabled={pending}
          onClick={() => void onSave("document", content)}
          type="button"
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Back to document
        </PortalButton>
      </div>
    </BuilderSection>
  );
}

export function AgreementBuilderStepPanel({
  agreement,
  content,
  draftExists,
  engagementHref,
  engagements,
  finalise,
  onBeginEngagement,
  onSave,
  organisationName,
  pending,
  step,
}: BuilderStepProps &
  Readonly<{
    draftExists: boolean;
    engagementHref: string;
    engagements: readonly AgreementEngagementChoice[];
    finalise: () => Promise<void>;
    organisationName: string;
    step: AgreementBuilderStep;
  }>): React.JSX.Element {
  switch (step) {
    case "scope":
      return (
        <ScopeStep
          agreement={agreement}
          content={content}
          onSave={onSave}
          pending={pending}
        />
      );
    case "fees":
      return (
        <AgreementBuilderFeesStep
          agreement={agreement}
          content={content}
          onSave={onSave}
          pending={pending}
        />
      );
    case "people":
      return (
        <PeopleStep
          agreement={agreement}
          content={content}
          onSave={onSave}
          pending={pending}
        />
      );
    case "document":
      return (
        <DocumentStep
          agreement={agreement}
          content={content}
          onSave={onSave}
          pending={pending}
        />
      );
    case "review":
      return (
        <ReviewStep
          agreement={agreement}
          content={content}
          draftExists={draftExists}
          finalise={finalise}
          onSave={onSave}
          pending={pending}
        />
      );
    case "link":
      return (
        <LinkStep
          agreement={agreement}
          content={content}
          engagementHref={engagementHref}
          engagements={engagements}
          onBeginEngagement={onBeginEngagement}
          onSave={onSave}
          organisationName={organisationName}
          pending={pending}
        />
      );
  }
}
