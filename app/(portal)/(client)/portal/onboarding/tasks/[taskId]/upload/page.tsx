import { ClientTaskPage } from "../task-page";

export const dynamic = "force-dynamic";

export default async function OnboardingUploadTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const [route, query] = await Promise.all([params, searchParams]);
  return (
    <ClientTaskPage
      expectedKind="upload"
      includeDocuments
      organisationId={query.organisationId}
      taskId={route.taskId}
    />
  );
}
