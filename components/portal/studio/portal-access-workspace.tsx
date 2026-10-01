"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
  PortalSelect,
} from "@/components/portal/ui";
import type { StudioPortalAccessOverview } from "@/lib/operations/studio/portal-access";
import { AccessDialog } from "./access-dialog";
import { AccessIdentityCard } from "./access-identity-card";
import { accessPageHref, accessStateLabels } from "./access-presentation";
import styles from "./portal-access.module.css";

const views = [
  { value: "clients", label: "Clients" },
  { value: "staff", label: "FSS staff" },
  { value: "invitations", label: "Invitations" },
] as const;

export function PortalAccessWorkspace({
  data,
  timezone = "Europe/London",
}: Readonly<{
  data: StudioPortalAccessOverview;
  timezone?: string;
}>): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  function complete(next: string): void {
    setMessage(next);
    document.getElementById("portal-access-result")?.focus();
    router.refresh();
  }
  const metrics = [
    ["Active client users", data.metrics.activeClientUsers],
    [
      "Active FSS staff",
      data.canManageStaff ? data.metrics.activeStaff : "Founder only",
    ],
    ["Pending invitations", data.metrics.pendingInvitations],
    ["Invitations needing attention", data.metrics.attentionInvitations],
  ] as const;
  return (
    <section aria-labelledby="portal-access-heading" className={styles.page}>
      <div tabIndex={-1} id="portal-access-result">
        <PageHeader
          action={
            <AccessDialog
              contacts={data.contacts}
              kind="client"
              onComplete={complete}
            />
          }
          description="Review people, their permissions and invitations in one place."
          eyebrow="FSS Studio · Access"
          title="People and portal access"
          titleId="portal-access-heading"
        />
      </div>
      <div className={styles.metrics} aria-label="Access totals">
        {metrics.map(([label, value]) => (
          <PortalCard key={label}>
            <p className={styles.metricLabel}>{label}</p>
            <p className={styles.metricValue}>{value}</p>
          </PortalCard>
        ))}
      </div>
      <p className={styles.detail}>
        Totals cover the authorised access register across all pages. Search and
        filters change the list below.
      </p>
      <div className={styles.toolbar}>
        <nav aria-label="Access views" className={styles.views}>
          {views
            .filter((view) => view.value !== "staff" || data.canManageStaff)
            .map((view) => (
              <a
                aria-current={data.view === view.value ? "page" : undefined}
                className={styles.view}
                href={accessPageHref({ ...data, view: view.value })}
                key={view.value}
              >
                {view.label}
              </a>
            ))}
        </nav>
        {data.canManageStaff ? (
          <AccessDialog kind="staff" onComplete={complete} />
        ) : null}
      </div>
      <PortalCard>
        <form
          className={styles.filters}
          key={`${data.view}:${data.query}:${data.state}`}
          method="get"
        >
          <input name="view" type="hidden" value={data.view} />
          <PortalField label="Search people or clients">
            <input
              defaultValue={data.query}
              maxLength={100}
              name="query"
              placeholder="Name, email or organisation"
              type="search"
            />
          </PortalField>
          <PortalSelect
            defaultValue={data.state ?? "all"}
            label="Access state"
            name="state"
          >
            <option value="all">All states</option>
            {Object.entries(accessStateLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </PortalSelect>
          <PortalButton type="submit" variant="secondary">
            Apply filter
          </PortalButton>
        </form>
      </PortalCard>
      {message ? <Notice tone="success">{message}</Notice> : null}
      {data.items.length === 0 ? (
        <PortalCard
          title={
            data.query || data.state
              ? "No matching people"
              : data.view === "invitations"
                ? "No invitations to review"
                : "No access records yet"
          }
        >
          <p className={styles.detail}>
            {data.query || data.state
              ? "Try a different search or clear the filters."
              : data.view === "staff"
                ? "Invite an FSS colleague to start their reviewed access."
                : "Client access begins when an invited contact accepts their invitation."}
          </p>
          {data.query || data.state ? (
            <PortalActionLink
              href={accessPageHref({ ...data, query: "", state: null })}
              variant="secondary"
            >
              Clear filters
            </PortalActionLink>
          ) : null}
        </PortalCard>
      ) : (
        <ul
          aria-label={`${views.find((view) => view.value === data.view)?.label} access register`}
          className={styles.list}
        >
          {data.items.map((entry) => (
            <li key={entry.id}>
              <AccessIdentityCard
                canManageStaff={data.canManageStaff}
                entry={entry}
                onComplete={complete}
                timezone={timezone}
              />
            </li>
          ))}
        </ul>
      )}
      {data.page > 1 || data.hasNext ? (
        <nav aria-label="Access register pages" className={styles.pagination}>
          {data.page > 1 ? (
            <PortalActionLink
              href={accessPageHref(data, data.page - 1)}
              variant="secondary"
            >
              Previous page
            </PortalActionLink>
          ) : (
            <span />
          )}
          <span>Page {data.page}</span>
          {data.hasNext ? (
            <PortalActionLink
              href={accessPageHref(data, data.page + 1)}
              variant="secondary"
            >
              Next page
            </PortalActionLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
