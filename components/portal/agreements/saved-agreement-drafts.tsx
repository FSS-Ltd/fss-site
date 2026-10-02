import {
  PortalActionLink,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import type { AgreementBuilderDraftSummary } from "@/lib/operations/agreements/builder-draft-repository";
import type { WorkspaceCollectionPage } from "@/lib/operations/workspaces/pagination";
import { studioDateLabel } from "@/components/portal/workspace/studio-date";
import styles from "./agreements.module.css";

export function SavedAgreementDrafts({
  drafts,
  builderHref,
  listHref,
  startNewHref,
}: Readonly<{
  drafts: WorkspaceCollectionPage<AgreementBuilderDraftSummary>;
  builderHref: string;
  listHref: string;
  startNewHref?: string;
}>): React.JSX.Element {
  function pageHref(page: number): string {
    const [path, query] = listHref.split("?");
    const search = new URLSearchParams(query);
    search.set("draftPage", String(page));
    return `${path}?${search.toString()}`;
  }
  return (
    <section
      className={styles.group}
      aria-labelledby="saved-agreement-drafts-heading"
    >
      <div className={styles.groupHeading}>
        <div>
          <h2 id="saved-agreement-drafts-heading">Saved agreement drafts</h2>
          <p>
            Continue where you left off. Your saved details and stage are
            restored.
          </p>
        </div>
        {startNewHref ? (
          <PortalActionLink href={startNewHref} variant="secondary">
            Start new agreement
          </PortalActionLink>
        ) : null}
      </div>
      {drafts.items.length ? (
        <ul className={styles.agreementList}>
          {drafts.items.map((draft) => (
            <li key={draft.id}>
              <PortalCard className={styles.listCard}>
                <div className={styles.cardHeading}>
                  <div>
                    <p className={styles.version}>
                      Saved version {draft.version}
                    </p>
                    <h3>{draft.title ?? "Untitled agreement"}</h3>
                  </div>
                  <StatusBadge status="warning">In progress</StatusBadge>
                </div>
                <p className={styles.muted}>
                  Continue at{" "}
                  {draft.step === "link"
                    ? "Work"
                    : draft.step[0].toUpperCase() + draft.step.slice(1)}{" "}
                  · Saved{" "}
                  <time dateTime={draft.updatedAt}>
                    {studioDateLabel(draft.updatedAt)}
                  </time>
                </p>
                <PortalActionLink
                  href={`${builderHref}?${new URLSearchParams({ draftId: draft.id }).toString()}`}
                >
                  Continue draft
                </PortalActionLink>
              </PortalCard>
            </li>
          ))}
        </ul>
      ) : (
        <PortalCard title="No saved drafts">
          <p className={styles.muted}>
            Drafts saved from the agreement builder appear here.
          </p>
        </PortalCard>
      )}
      {drafts.page > 1 || drafts.hasNext ? (
        <nav
          className={styles.actionRow}
          aria-label="Saved agreement draft pages"
        >
          {drafts.page > 1 ? (
            <PortalActionLink
              href={pageHref(drafts.page - 1)}
              variant="secondary"
            >
              Previous draft page
            </PortalActionLink>
          ) : null}
          <span>Draft page {drafts.page}</span>
          {drafts.hasNext ? (
            <PortalActionLink
              href={pageHref(drafts.page + 1)}
              variant="secondary"
            >
              Next draft page
            </PortalActionLink>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
