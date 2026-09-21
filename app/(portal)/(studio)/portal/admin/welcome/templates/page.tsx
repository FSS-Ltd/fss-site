import { StaffTemplateEditorPage } from "@/components/portal/onboarding/staff-template-editor-page";

export const dynamic = "force-dynamic";

export default async function WelcomeTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ organisationId?: string }>;
}): Promise<React.JSX.Element> {
  return (
    <StaffTemplateEditorPage
      organisationId={(await searchParams).organisationId}
    />
  );
}
