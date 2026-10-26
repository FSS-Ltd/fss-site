export type CrmErrorCode =
  | "not_found"
  | "version_conflict"
  | "duplicate"
  | "duplicate_view"
  | "closed"
  | "invalid";
const messages: Record<CrmErrorCode, string> = {
  not_found: "This CRM record was not found.",
  version_conflict:
    "This record changed. Refresh and review the latest version before saving.",
  duplicate:
    "This identity already has an open lead, or the contact belongs to another company. Open the existing record.",
  duplicate_view: "A saved view already uses this name. Choose another name.",
  closed:
    "Closed opportunities retain their agreed terms. Create another opportunity instead.",
  invalid: "Check the record fields and try again.",
};
export class CrmError extends Error {
  constructor(
    readonly code: CrmErrorCode,
    readonly prospectId?: string,
  ) {
    super(messages[code]);
    this.name = "CrmError";
  }
}
