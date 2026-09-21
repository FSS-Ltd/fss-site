import { StaffTemplateEditorPage } from "@/components/portal/onboarding/staff-template-editor-page";

export const dynamic = "force-dynamic";

export default async function WelcomeTemplateTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ organisationId?: string }>;
}): Promise<React.JSX.Element> {
  const [{ templateId }, { organisationId }] = await Promise.all([
    params,
    searchParams,
  ]);
  return (
    <StaffTemplateEditorPage
      initialTemplateId={templateId}
      organisationId={organisationId}
    />
  );
}
