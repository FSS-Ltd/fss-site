import {
  FileText,
  FolderKanban,
  MessageSquareText,
  PenLine,
} from "lucide-react";
import { OrganisationOnboarding } from "@/components/portal/auth/organisation-onboarding";
import { NewStudioProjectForm } from "@/components/portal/studio/new-project-form";
import { ClientShell } from "@/components/portal/shell/client-shell";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader, PortalCard, StatusBadge } from "@/components/portal/ui";

const registerStyles = {
  list: {
    display: "grid",
    gap: 8,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  row: {
    alignItems: "center",
    background: "var(--portal-surface)",
    border: "1px solid var(--portal-border)",
    borderRadius: 12,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "minmax(0, 1fr) auto",
    padding: 16,
  },
  title: {
    color: "var(--portal-ink)",
    fontSize: "0.9375rem",
    fontWeight: 650,
    margin: 0,
  },
  detail: {
    color: "var(--portal-muted)",
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    margin: "4px 0 0",
  },
} as const;

function StudioRegisterRows({
  rows,
}: Readonly<{
  rows: readonly Readonly<{
    title: string;
    detail: string;
    status: string;
    icon: React.ReactNode;
  }>[];
}>): React.JSX.Element {
  return (
    <ul style={registerStyles.list}>
      {rows.map((row) => (
        <li key={row.title} style={registerStyles.row}>
          <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
            <span aria-hidden="true">{row.icon}</span>
            <div>
              <h2 style={registerStyles.title}>{row.title}</h2>
              <p style={registerStyles.detail}>{row.detail}</p>
            </div>
          </div>
          <StatusBadge status="info">{row.status}</StatusBadge>
        </li>
      ))}
    </ul>
  );
}

export function ClientOrganisationOnboardingScenario(): React.JSX.Element {
  return (
    <ClientShell
      memberships={[
        {
          displayName: "Northstar Studio",
          organisationId: "f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55",
          role: "owner",
        },
      ]}
    >
      <OrganisationOnboarding homePath="/portal" />
    </ClientShell>
  );
}

export function StudioClientAgreementRegisterScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        breadcrumbs={[
          { label: "Clients" },
          { label: "Northstar Studio" },
          { label: "Agreements" },
        ]}
        eyebrow="FSS Studio / Agreements"
        title="Northstar Studio: agreements"
      />
      <StudioRegisterRows
        rows={[
          {
            detail: "Revision 3 · Website & booking experience",
            icon: <FileText aria-hidden="true" size={18} />,
            status: "Draft",
            title: "Website & booking experience",
          },
          {
            detail: "Revision 2 · Signed 18 September",
            icon: <FileText aria-hidden="true" size={18} />,
            status: "Signed",
            title: "Discovery and planning",
          },
        ]}
      />
    </StudioShell>
  );
}

export function StudioClientRequestRegisterScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        breadcrumbs={[
          { label: "Clients" },
          { label: "Northstar Studio" },
          { label: "Requests" },
        ]}
        eyebrow="FSS Studio / Delivery"
        title="Client requests"
      />
      <StudioRegisterRows
        rows={[
          {
            detail: "Review booking flow · v3 · Target 24 September",
            icon: <MessageSquareText aria-hidden="true" size={18} />,
            status: "Ready for review",
            title: "Review booking flow",
          },
          {
            detail: "Confirm service details · Owner Jean-Fidele",
            icon: <MessageSquareText aria-hidden="true" size={18} />,
            status: "In progress",
            title: "Booking confirmation email",
          },
        ]}
      />
    </StudioShell>
  );
}

export function StudioClientSigningRegisterScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        breadcrumbs={[{ label: "Agreements" }, { label: "Signing" }]}
        eyebrow="FSS Studio / Agreements"
        title="Signing status"
      />
      <PortalCard title="Website & booking experience">
        <StudioRegisterRows
          rows={[
            {
              detail: "Alex Morgan · Request prepared 20 September",
              icon: <PenLine aria-hidden="true" size={18} />,
              status: "Awaiting approval",
              title: "Client signer",
            },
            {
              detail: "FSS authorised signer · No signature recorded",
              icon: <PenLine aria-hidden="true" size={18} />,
              status: "Pending",
              title: "FSS signer",
            },
          ]}
        />
      </PortalCard>
    </StudioShell>
  );
}

export function StudioProjectRegisterScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Projects"
        title="Project workspace"
        description="Cross-client delivery plans, milestones, and retained document counts."
      />
      <StudioRegisterRows
        rows={[
          {
            detail: "Northstar Studio · Target 6 October · 4 milestones",
            icon: <FolderKanban aria-hidden="true" size={18} />,
            status: "Active",
            title: "Website & booking experience",
          },
          {
            detail: "Harbour Foundation · Target 12 October · 2 milestones",
            icon: <FolderKanban aria-hidden="true" size={18} />,
            status: "Planned",
            title: "Membership portal kickoff",
          },
        ]}
      />
    </StudioShell>
  );
}

export function StudioProjectCreateScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <NewStudioProjectForm
        agreements={[
          {
            id: "584a707c-7072-4f5a-92d0-5b1447f05db5",
            title: "Website & booking experience · Revision 3",
          },
        ]}
        organisationId="f10e9fc0-8c60-4f8e-8772-3d01a2bdfc55"
        organisationName="Northstar Studio"
      />
    </StudioShell>
  );
}

export function StudioProjectDocumentsScenario(): React.JSX.Element {
  return (
    <StudioShell>
      <PageHeader
        breadcrumbs={[{ label: "Projects" }, { label: "Documents" }]}
        eyebrow="FSS Studio / Projects"
        title="Document register"
        description="Project documents linked to delivery work. Agreement signing documents stay in the client signing workspace."
      />
      <StudioRegisterRows
        rows={[
          {
            detail:
              "Website & booking experience · Client visible · Scan complete",
            icon: <FileText aria-hidden="true" size={18} />,
            status: "Ready",
            title: "Approved booking copy.pdf",
          },
          {
            detail: "Membership portal kickoff · Internal · Scan complete",
            icon: <FileText aria-hidden="true" size={18} />,
            status: "Internal",
            title: "Kickoff notes.docx",
          },
        ]}
      />
    </StudioShell>
  );
}
