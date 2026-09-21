import { AgreementBuilder } from "@/components/portal/agreements/agreement-builder";
import { ClientAgreementDetail } from "@/components/portal/agreements/client-agreement-detail";
import { ClientAgreementList } from "@/components/portal/agreements/client-agreement-list";
import { ClientSigningReview } from "@/components/portal/agreements/client-signing-review";
import { StaffAgreementDetail } from "@/components/portal/agreements/staff-agreement-detail";
import { StaffAgreementOverview } from "@/components/portal/agreements/staff-agreement-overview";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader } from "@/components/portal/ui";
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

export function StudioAgreementBuilderScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Create an agreement"
      />
      <AgreementBuilder
        engagementChoices={[
          {
            id: signedRecord.engagementId,
            name: "Website & booking experience · Discovery complete",
          },
        ]}
        engagementHref="/admin/clients/example/engagements/new"
        organisationName="Northstar Studio"
        step="fees"
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
      />
    </StudioShell>
  );
}
