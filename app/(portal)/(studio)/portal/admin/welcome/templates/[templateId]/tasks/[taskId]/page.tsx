import { StaffTemplateEditorPage } from "@/components/portal/onboarding/staff-template-editor-page";

export const dynamic = "force-dynamic";

export default async function WelcomeTemplateTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string; taskId: string }>;
  searchParams: Promise<{ organisationId?: string }>;
}): Promise<React.JSX.Element> {
  const [{ templateId, taskId }, { organisationId }] = await Promise.all([
    params,
    searchParams,
  ]);
  return (
    <StaffTemplateEditorPage
      initialTaskId={taskId}
      initialTemplateId={templateId}
      organisationId={organisationId}
    />
  );
}
