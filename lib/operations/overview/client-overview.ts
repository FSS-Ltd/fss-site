import {
  hasPortalCapability,
  type PortalCapability,
} from "../auth/permissions";
import { requirePortalMember } from "../auth/require-member";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import {
  getClientSetupChecklist,
  type ClientSetupChecklist,
} from "../onboarding/client-checklist";
import { listPortalProjects } from "../projects/repository";
import type { ProjectStatus } from "../projects/types";
import { listPortalRequests } from "../requests/repository";
import type { RequestStatus } from "../requests/types";
import { portalPath } from "../auth/portal-url";
import { listPortalNotifications } from "../workspaces/portal-repository";

export type ClientOverviewProject = Readonly<{
  id: string;
  status: ProjectStatus;
  summary: string;
  targetDate: string | null;
  title: string;
}>;

export type ClientOverviewRequest = Readonly<{
  id: string;
  nextAction: string;
  publicSummary: string;
  status: RequestStatus;
  targetDate: string | null;
  title: string;
}>;

export type ClientOverviewNotification = Readonly<{
  body: string;
  id: string;
  requestId: string;
  title: string;
}>;

export type ClientOverview = Readonly<{
  checklist: ClientSetupChecklist | null;
  notifications: readonly ClientOverviewNotification[] | null;
  organisationId: string;
  projects: readonly ClientOverviewProject[] | null;
  requests: readonly ClientOverviewRequest[] | null;
}>;

export type ClientOverviewAttention = Readonly<{
  actionLabel: string;
  description: string;
  href: string;
  kind: "review" | "setup" | "project";
  title: string;
}>;

export type ClientOverviewStep = Readonly<{
  description: string;
  href: string;
  title: string;
}>;

const setupItems: readonly Readonly<{
  complete: keyof ClientSetupChecklist;
  description: string;
  title: string;
}>[] = [
  {
    complete: "agreementSigned",
    description: "Review and sign your agreement so delivery can continue.",
    title: "Review your agreement",
  },
  {
    complete: "billingReady",
    description: "Confirm billing details for your workspace.",
    title: "Confirm billing details",
  },
  {
    complete: "filesReady",
    description: "Share the files your delivery team needs next.",
    title: "Share project files",
  },
  {
    complete: "serviceReady",
    description: "Confirm your service preferences before work begins.",
    title: "Confirm service preferences",
  },
];

function organisationHref(pathname: string, organisationId: string): string {
  return `${portalPath(pathname)}?organisationId=${encodeURIComponent(organisationId)}`;
}

function firstIncompleteSetupItem(
  checklist: ClientSetupChecklist | null,
): (typeof setupItems)[number] | null {
  if (!checklist) return null;
  return setupItems.find((item) => !checklist[item.complete]) ?? null;
}

function hasCapability(
  role: Parameters<typeof hasPortalCapability>[0],
  capability: PortalCapability,
): boolean {
  return hasPortalCapability(role, capability);
}

export async function loadClientOverview(
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  organisationId: string,
  correlationId: string,
): Promise<ClientOverview> {
  const membership = await requirePortalMember(
    db,
    identity,
    organisationId,
    correlationId,
  );
  const role = membership.role;
  const [projects, requests, notifications, checklist] = await Promise.all([
    hasCapability(role, "projects.read")
      ? listPortalProjects(db, identity, organisationId, correlationId)
      : Promise.resolve(null),
    hasCapability(role, "requests.comment")
      ? listPortalRequests(db, identity, organisationId, correlationId, { page: 1 })
      : Promise.resolve(null),
    hasCapability(role, "notifications.read")
      ? listPortalNotifications(
          db,
          identity,
          organisationId,
          correlationId,
          "all",
          1,
        )
      : Promise.resolve(null),
    hasCapability(role, "onboarding.read")
      ? getClientSetupChecklist(db, identity, organisationId, correlationId)
      : Promise.resolve(null),
  ]);

  return {
    checklist,
    notifications: notifications?.items.map((notification) => ({
      body: notification.body,
      id: notification.id,
      requestId: notification.requestId,
      title: notification.title,
    })) ?? null,
    organisationId,
    projects: projects?.map((project) => ({
      id: project.id,
      status: project.status,
      summary: project.summary,
      targetDate: project.targetDate,
      title: project.title,
    })) ?? null,
    requests: requests?.items.map((request) => ({
      id: request.id,
      nextAction: request.nextAction,
      publicSummary: request.publicSummary,
      status: request.status,
      targetDate: request.targetDate,
      title: request.title,
    })) ?? null,
  };
}

export function selectClientAttention(
  overview: ClientOverview,
): ClientOverviewAttention | null {
  const review = overview.requests?.find(
    (request) => request.status === "ready_for_review",
  );
  if (review) {
    return {
      actionLabel: "Review update",
      description:
        review.publicSummary || review.nextAction || "Review the latest delivery.",
      href: organisationHref(`/portal/requests/${review.id}`, overview.organisationId),
      kind: "review",
      title: review.title,
    };
  }

  const setup = firstIncompleteSetupItem(overview.checklist);
  if (setup) {
    return {
      actionLabel: "Continue setup",
      description: setup.description,
      href: organisationHref("/portal/getting-started", overview.organisationId),
      kind: "setup",
      title: setup.title,
    };
  }

  const project = overview.projects?.find(
    (candidate) => candidate.status !== "completed" && candidate.status !== "paused",
  );
  if (project) {
    return {
      actionLabel: "View project",
      description: project.summary,
      href: organisationHref(`/portal/projects/${project.id}`, overview.organisationId),
      kind: "project",
      title: project.title,
    };
  }

  return null;
}

export function getClientOverviewSteps(
  overview: ClientOverview,
): ClientOverviewStep[] {
  const attention = selectClientAttention(overview);
  const steps: ClientOverviewStep[] = [
    ...(attention
      ? [
          {
            description: attention.description,
            href: attention.href,
            title: attention.title,
          },
        ]
      : []),
    ...(overview.projects
      ?.filter((project) => project.status === "waiting_for_you")
      .map((project) => ({
        description: project.summary,
        href: organisationHref(
          `/portal/projects/${project.id}`,
          overview.organisationId,
        ),
        title: project.title,
      })) ?? []),
  ];
  const seen = new Set<string>();

  return steps.filter((step) => {
    if (seen.has(step.href)) return false;
    seen.add(step.href);
    return true;
  }).slice(0, 3);
}
