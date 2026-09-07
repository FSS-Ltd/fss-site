import type { RequestStatus } from "./types";
const transitions: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ["acknowledged", "cancelled"],
  acknowledged: ["planned", "cancelled"],
  planned: ["in_progress", "cancelled"],
  in_progress: ["ready_for_review", "cancelled"],
  ready_for_review: ["done", "changes_requested", "cancelled"],
  changes_requested: ["in_progress", "cancelled"],
  done: ["acknowledged"],
  cancelled: [],
};
export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return transitions[from].includes(to);
}
