export type OperationsFounder = { readonly actorId: string };

export type OrganisationInput = {
  id: string;
  legalName: string;
  displayName: string;
  tradingStatus: "active" | "inactive" | "unknown";
  timezone: string;
  engagementIds: string[];
};

export type ReviewedMapping = {
  reviewReference: string;
  organisations: OrganisationInput[];
};

export type OrganisationListRow = {
  id: string;
  legalName: string;
  displayName: string;
  tradingStatus: OrganisationInput["tradingStatus"];
  timezone: string;
  lifecycle: "active" | "archived";
  engagementCount: number;
};

export type OrganisationPage = {
  rows: OrganisationListRow[];
  nextCursor: string | null;
  page?: number;
  hasNext?: boolean;
};

export type MappingResult = {
  organisationsCreated: number;
  engagementsLinked: number;
};
