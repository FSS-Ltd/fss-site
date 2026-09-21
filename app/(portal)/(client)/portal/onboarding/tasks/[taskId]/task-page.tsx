import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PortalUnavailable } from "@/components/portal/auth/unavailable";
import { ClientOnboardingTaskDetail } from "@/components/portal/onboarding/client-onboarding-task";
import { getPortalPageContext } from "@/lib/operations/auth/page-context";
import { PortalAccessDenied } from "@/lib/operations/auth/types";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import {
  loadClientOnboardingWorkspace,
  type ClientOnboardingTask,
  type ClientOnboardingWorkspace,
} from "@/lib/operations/onboarding/client-workspace";
import { onboardingEnabled } from "@/lib/operations/onboarding/worker-db";
import { listPortalWorkspaceDocuments } from "@/lib/operations/workspaces/portal-repository";
import type { PortalWorkspaceDocument } from "@/lib/operations/workspaces/types";

type ClientTaskPageProps = Readonly<{
  expectedKind?: ClientOnboardingTask["kind"];
  includeDocuments?: boolean;
  organisationId: unknown;
  taskId: unknown;
}>;

export async function ClientTaskPage({
  expectedKind,
  includeDocuments = false,
  organisationId,
  taskId,
}: ClientTaskPageProps): Promise<React.JSX.Element> {
  const context = await getPortalPageContext(organisationId);
  if (!context || !onboardingEnabled()) return <PortalUnavailable />;
  const parsedTaskId = z.uuid().safeParse(taskId);
  if (!parsedTaskId.success) notFound();

  let workspace: ClientOnboardingWorkspace;
  try {
    workspace = await loadClientOnboardingWorkspace(
      getPortalDb(),
      context.identity,
      context.organisationId,
      randomUUID(),
    );
  } catch (error) {
    if (error instanceof PortalAccessDenied) notFound();
    return <PortalUnavailable />;
  }
  const task = workspace.tasks.find(
    (candidate) => candidate.id === parsedTaskId.data,
  );
  if (!task || (expectedKind && task.kind !== expectedKind)) notFound();

  let documents: readonly PortalWorkspaceDocument[] | undefined;
  if (includeDocuments)
    try {
      const documentPage = await listPortalWorkspaceDocuments(
        getPortalDb(),
        context.identity,
        context.organisationId,
        randomUUID(),
        1,
      );
      documents = documentPage.items;
    } catch (error) {
      if (error instanceof PortalAccessDenied) notFound();
      return <PortalUnavailable />;
    }

  return (
    <ClientOnboardingTaskDetail
      documents={documents}
      organisationId={context.organisationId}
      task={task}
    />
  );
}
