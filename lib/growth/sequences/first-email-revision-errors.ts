export type FirstEmailRevisionErrorCode =
  | "not_found"
  | "not_editable"
  | "version_conflict"
  | "revision_limit_reached"
  | "invalid_stored_draft";

export class FirstEmailRevisionError extends Error {
  constructor(readonly code: FirstEmailRevisionErrorCode) {
    super("The first-email draft could not be revised.");
    this.name = "FirstEmailRevisionError";
  }
}
