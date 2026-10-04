import { SavedAgreementDrafts } from "@/components/portal/agreements/saved-agreement-drafts";
import { StudioShell } from "@/components/portal/shell/studio-shell";
import { PageHeader } from "@/components/portal/ui";

export function StudioSavedAgreementDraftsScenario(): React.JSX.Element {
  const builderHref = "/visual/fss-studio/studio-agreement-builder-fees";
  return (
    <StudioShell>
      <PageHeader
        eyebrow="FSS Studio / Agreements"
        title="Continue an agreement"
      />
      <SavedAgreementDrafts
        drafts={{
          page: 1,
          hasNext: false,
          items: [
            {
              id: "e5d6e353-c33d-488f-9cb0-1d7b05e07050",
              title: "Website & booking experience",
              step: "fees",
              version: 3,
              updatedAt: "2026-10-02T20:00:00.000Z",
            },
          ],
        }}
        builderHref={builderHref}
        listHref="/visual/fss-studio/studio-agreement-drafts"
        startNewHref="/visual/fss-studio/studio-agreement-builder?new=1"
      />
    </StudioShell>
  );
}
