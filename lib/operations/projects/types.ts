export const projectStatuses = [
  "planned",
  "active",
  "waiting_for_us",
  "waiting_for_you",
  "completed",
  "paused",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
export type ClientProject = {
  id: string;
  agreementId: string;
  title: string;
  summary: string;
  outcome: string;
  deliverables: string[];
  status: ProjectStatus;
  ownerDisplay: string;
  targetDate: string | null;
  scheduleDependencies: string[];
  scheduleEvidence: string | null;
};
export type ClientMilestone = {
  id: string;
  title: string;
  summary: string;
  status: ProjectStatus;
  ownerDisplay: string;
  targetDate: string | null;
  evidence: string | null;
};
export type ClientProjectDetail = ClientProject & {
  milestones: ClientMilestone[];
};
export class ProjectConflict extends Error {
  constructor(message = "This project changed. Reload before trying again.") {
    super(message);
    this.name = "ProjectConflict";
  }
}
