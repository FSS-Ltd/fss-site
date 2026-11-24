import type { FacebookWorkspaceDto } from "@/lib/growth/facebook/workspace";
export type ReadyWorkspace = Extract<FacebookWorkspaceDto, { status: "ready" }>;
export type Destination = ReadyWorkspace["destinations"][number];
