import { ClientCommercialOffer } from "@/components/portal/agreements/client-commercial-offer";
import { StaffCommercialOffer } from "@/components/portal/agreements/staff-commercial-offer";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader } from "@/components/portal/ui";
import { agreementDraft } from "@/lib/operations/agreements/fixtures";
import type { CommercialOffer } from "@/lib/operations/agreements/commercial-types";

const organisationId = "22222222-2222-4222-8222-222222222222";
const offer: CommercialOffer = {
  id: "11111111-1111-4111-8111-111111111111",
  organisationId,
  engagementId: "33333333-3333-4333-8333-333333333333",
  version: 1,
  status: "published",
  draft: {
    ...agreementDraft(),
    currency: "EUR",
    lines: [
      ...agreementDraft().lines,
      {
        ...agreementDraft().lines[0],
        serviceCode: "retainer",
        description: "Ongoing support",
        recurrenceMonths: 1,
        unitPence: "0",
        discountPence: "0",
        taxPence: "0",
      },
    ],
  },
  spec: {
    cash: { mode: "client_proposed" },
    revenueShare: {
      mode: "client_proposed",
      revenueSource: "Product sales",
      calculationBasis: "Received revenue excluding refunds",
      duration: "24 months",
      reportingRequirements: "Monthly statement",
      paymentTerms: "14 days after reporting",
    },
  },
  expiresAt: "2027-11-01T00:00:00Z",
  selection: null,
  rejectionReason: null,
  approvalId: null,
  agreementId: null,
};
const memberships = [
  { organisationId, displayName: "Northstar", role: "owner" as const },
];
export function ClientCommercialScenario(): React.JSX.Element {
  return (
    <ClientShell memberships={memberships}>
      <PageHeader title="Choose payment terms" />
      <ClientCommercialOffer offer={offer} />
    </ClientShell>
  );
}
export function StaffCommercialScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader title="Review payment proposal" />
      <StaffCommercialOffer
        offer={{
          ...offer,
          status: "proposed",
          selection: { option: "cash", recurringAmountMinor: "2000" },
        }}
      />
    </StudioShell>
  );
}
