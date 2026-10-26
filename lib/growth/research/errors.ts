export class ResearchIngestionError extends Error {
  constructor(
    public readonly code: "invalid_asset_reference" | "suppressed_contact",
    message: string,
  ) {
    super(message);
    this.name = "ResearchIngestionError";
  }
}
