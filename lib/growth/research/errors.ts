export class ResearchIngestionError extends Error {
  constructor(
    public readonly code:
      | "invalid_asset_reference"
      | "suppressed_contact"
      | "signed_research_required"
      | "request_conflict"
      | "invalid_proof",
    message: string,
  ) {
    super(message);
    this.name = "ResearchIngestionError";
  }
}
