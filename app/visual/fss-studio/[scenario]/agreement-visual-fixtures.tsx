import { ClientAgreementDetail } from "@/components/portal/agreements/client-agreement-detail";
import { ClientAgreementList } from "@/components/portal/agreements/client-agreement-list";
import { ClientSigningReview } from "@/components/portal/agreements/client-signing-review";
import { RoutedEngagementForm } from "@/components/portal/agreements/routed-engagement-form";
import { StaffAgreementDetail } from "@/components/portal/agreements/staff-agreement-detail";
import { RoutedStaffAgreementBuilder } from "@/components/portal/agreements/routed-staff-agreement-builder";
import type { AgreementEngagementChoice } from "@/components/portal/agreements/staff-agreement-builder";
import { StaffAgreementOverview } from "@/components/portal/agreements/staff-agreement-overview";
import { StaffSigningStatus } from "@/components/portal/agreements/staff-signing-status";
import { SignatureEvidenceForm } from "@/components/portal/agreements/signature-evidence-form";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader } from "@/components/portal/ui";
import type { AgreementBuilderStep } from "@/lib/operations/agreements/builder-draft-schema";
import type { AgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-service";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
import type { SigningApproval } from "@/lib/operations/agreements/signing-types";

const organisationId = "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55";
const approvalId = "2f7f81f7-f27e-4618-a05c-6d3db8334d04";
const agreementId = "584a707c-7072-4f5a-92d0-5b1447f05db5";

const draft = {
  assetsRequired: true,
  billingContact: "alex@northstar.example",
  currency: "GBP" as const,
  documentHash: "a".repeat(64),
  documentReference: "private:signing/fixture/source.pdf",
  goals: "Make it easier for customers to book online.",
  installments: [
    { amountPence: "120000", dueDate: "2026-09-15" },
    { amountPence: "120000", dueDate: "2026-10-15" },
    { amountPence: "120000", dueDate: "2026-11-15" },
    { amountPence: "120000", dueDate: "2026-12-15" },
  ],
  lines: [
    {
      description: "Website & booking experience",
      discountPence: "0",
      endDate: null,
      quantity: 1,
      recurrenceMonths: 0 as const,
      serviceCode: "website",
      startDate: "2026-09-15",
      taxPence: "0",
      unitPence: "480000",
    },
  ],
  minimumTermMonths: 0,
  noticeDays: 30,
  requiredDepositPence: "120000",
  responsibilities:
    "Provide approved brand assets, copy and one authorised reviewer.",
  scope:
    "Five content pages, booking workflow, confirmation email and handover.",
  signatories: ["alex@northstar.example", "fss@faithful.software"],
  support:
    "Defect support is included. Additional scope needs a separate quote.",
  taxTreatment: "Tax follows the agreement.",
  terms: "The retained agreement is the governing version.",
  title: "Website & booking experience",
};

const builderAgreement = {
  assetsRequired: draft.assetsRequired,
  billingContact: draft.billingContact,
  currency: draft.currency,
  goals: draft.goals,
  installments: draft.installments,
  lines: draft.lines,
  minimumTermMonths: draft.minimumTermMonths,
  noticeDays: draft.noticeDays,
  requiredDepositPence: draft.requiredDepositPence,
  responsibilities: draft.responsibilities,
  scope: draft.scope,
  signatories: draft.signatories,
  support: draft.support,
  taxTreatment: draft.taxTreatment,
  terms: draft.terms,
  title: draft.title,
};

const engagementChoices: readonly AgreementEngagementChoice[] = [
  {
    id: "9d8be1e3-f8d8-4fe1-b15d-01e78c438384",
    name: "Website & booking experience · Discovery complete",
  },
];

const approval: SigningApproval = {
  agreementId,
  agreementVersion: 2,
  approvalHash: "b".repeat(64),
  approvedAt: "2026-09-15T10:00:00.000Z",
  completedAt: null,
  createdAt: "2026-09-15T09:00:00.000Z",
  draft,
  expiresAt: "2026-10-15T10:00:00.000Z",
  id: approvalId,
  organisationId,
  organisationLegalName: "Northstar Studio Ltd",
  requiredSigners: draft.signatories,
  revision: 2,
  signatures: [],
  sourceHash: "c".repeat(64),
  status: "approved",
  title: draft.title,
};

const completedApproval: SigningApproval = {
  ...approval,
  completedAt: "2026-09-15T11:25:00.000Z",
  signatures: [
    {
      email: "alex@northstar.example",
      signedAt: "2026-09-15T11:24:00.000Z",
      typedName: "Alex Morgan",
      userId: "a29f4e42-9b72-4202-a4c8-55a75f4d03dc",
    },
    {
      email: "fss@faithful.software",
      signedAt: "2026-09-15T11:25:00.000Z",
      typedName: "FSS authorised signer",
      userId: "a4d4a4c5-bf79-4bf9-8fea-19bef0e809fc",
    },
  ],
  status: "completed",
};

const signedRecord: AgreementRecord = {
  draft,
  engagementId: "9d8be1e3-f8d8-4fe1-b15d-01e78c438384",
  evidence: {
    certificateReference: "private:signing/fixture/audit.json",
    confirmed: true,
    documentReference: "private:signing/fixture/signed.pdf",
    signedDate: "2026-09-15",
    signedDocumentHash: "d".repeat(64),
    signatories: draft.signatories,
    sourceHash: draft.documentHash,
  },
  evidenceProvenance: "authenticated_portal_electronic_signature",
  id: agreementId,
  revision: 2,
  services: [],
  status: "signed",
  version: 3,
};

const memberships = [
  { displayName: "Northstar Studio", organisationId, role: "owner" as const },
];

function builderDraft(
  step: AgreementBuilderStep,
  noEngagement = false,
): AgreementBuilderDraft {
  return {
    content: noEngagement
      ? { agreement: { title: draft.title } }
      : {
          agreement: builderAgreement,
          engagementId: signedRecord.engagementId,
        },
    createdAt: "2026-09-15T09:00:00.000Z",
    engagementId: noEngagement ? null : signedRecord.engagementId,
    id: "e5d6e353-c33d-488f-9cb0-1d7b05e07050",
    organisationId,
    step,
    updatedAt: "2026-09-15T09:00:00.000Z",
    version: 3,
  };
}

export function ClientAgreementListScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={memberships}>
      <PageHeader eyebrow="FSS Studio / Agreements" title="Your agreements" />
      <ClientAgreementList
        approvals={[approval]}
        organisationId={organisationId}
      />
    </ClientShell>
  );
}

export function ClientAgreementDetailScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={memberships}>
      <PageHeader eyebrow="FSS Studio / Agreements" title={draft.title} />
      <ClientAgreementDetail
        approval={approval}
        email="alex@northstar.example"
        organisationId={organisationId}
      />
    </ClientShell>
  );
}

export function ClientAgreementSignedScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={memberships}>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Your signed agreement"
      />
      <ClientAgreementDetail
        approval={completedApproval}
        email="alex@northstar.example"
        organisationId={organisationId}
      />
    </ClientShell>
  );
}

export function ClientAgreementSigningScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={memberships}>
      <PageHeader eyebrow="FSS Studio / Agreements" title="Review and sign" />
      <ClientSigningReview
        approval={approval}
        email="alex@northstar.example"
        organisationId={organisationId}
        signerName="Alex Morgan"
      />
    </ClientShell>
  );
}

export function StudioAgreementListScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <StaffAgreementOverview
        agreements={[
          {
            agreementCount: 2,
            draftCount: 1,
            organisationId,
            organisationName: "Northstar Studio",
            signedCount: 1,
          },
        ]}
        signingReadiness={[
          {
            approvalId,
            organisationId,
            organisationName: "Northstar Studio",
            status: "approved",
            title: draft.title,
          },
        ]}
      />
    </StudioShell>
  );
}

export function StudioAgreementBuilderScenario({
  noEngagement = false,
  step = "link",
}: Readonly<{
  noEngagement?: boolean;
  step?: AgreementBuilderStep;
}>): React.JSX.Element {
  const currentDraft = builderDraft(step, noEngagement);
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Create an agreement"
      />
      <RoutedStaffAgreementBuilder
        agreementListHref={`/portal/admin/clients/${organisationId}/agreements`}
        baseHref={`/portal/admin/clients/${organisationId}/agreements/new`}
        commandEndpoint={`/api/portal/admin/clients/${organisationId}/agreement-drafts`}
        engagementHref={`/portal/admin/clients/${organisationId}/engagements/new?draftId=${currentDraft.id}`}
        engagements={
          noEngagement
            ? []
            : [
                ...engagementChoices,
                {
                  id: "92d68fbd-dbe8-44da-96b2-35da77283e40",
                  name: "Client portal · Discovery complete",
                },
              ]
        }
        initialDraft={currentDraft}
        organisationName="Northstar Studio"
      />
    </StudioShell>
  );
}

export function StudioAgreementSignedScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Signed and recorded"
      />
      <StaffAgreementDetail
        organisationId={organisationId}
        record={signedRecord}
        signingApproval={completedApproval}
        signingDownloadBase={`/api/portal/admin/clients/${organisationId}/signing/${approvalId}`}
      />
    </StudioShell>
  );
}

export function StudioEngagementProvenanceScenario(): React.JSX.Element {
  const agreementHref = `/portal/admin/clients/${organisationId}/agreements/new?draftId=e5d6e353-c33d-488f-9cb0-1d7b05e07050`;
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Create an engagement"
      />
      <RoutedEngagementForm
        agreementHref={agreementHref}
        commandEndpoint={`/api/portal/admin/clients/${organisationId}/engagements`}
        draft={{ id: "e5d6e353-c33d-488f-9cb0-1d7b05e07050", version: 1 }}
        engagementChoices={engagementChoices}
        organisationName="Northstar Studio"
        returnBaseHref={`/portal/admin/clients/${organisationId}/agreements/new`}
      />
    </StudioShell>
  );
}

export function StudioSignatureEvidenceScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Record signed evidence"
      />
      <SignatureEvidenceForm
        organisationId={organisationId}
        record={signedRecord}
      />
    </StudioShell>
  );
}

export function StudioSigningStatusScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader eyebrow="FSS Studio / Agreements" title="Signing status" />
      <StaffSigningStatus
        approval={approval}
        downloadBase={`/api/portal/admin/clients/${organisationId}/signing/${approvalId}`}
      />
    </StudioShell>
  );
}
