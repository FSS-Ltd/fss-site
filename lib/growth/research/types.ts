export type CorporateType =
  | "limited_company"
  | "llp"
  | "scottish_partnership"
  | "other_corporate";

export type BusinessCandidate = {
  legalName: string;
  tradingName: string | null;
  companyNumber: string;
  corporateType: CorporateType;
  corporateStatus: "active";
  sector: string;
  locality: string;
  county: "Kent";
  websiteUrl: string | null;
  googlePlaceId: string | null;
  googleMapsReferenceUrl: string | null;
  firstPartySourceUrl: string;
  verifiedAt: string;
};

export type ContactCandidate = {
  firstName: string;
  lastName: string;
  roleTitle: string | null;
  email: string;
  emailSourceUrl: string;
  emailVerifiedAt: string;
  subscriberType: "corporate";
  lawfulBasis: "legitimate_interests";
  mailboxType: "corporate" | "personal";
};

export type ProspectCandidate = {
  fitScore: number;
  opportunitySummary: string;
  recommendedOffer: string;
  estimatedOneOffMinPence: number;
  estimatedOneOffMaxPence: number;
  estimatedMonthlyPence: number;
  nextAction: string | null;
  nextActionDueAt: string | null;
};

export type EvidenceCandidate = {
  sourceType: "companies_house" | "first_party" | "google_maps_reference";
  sourceUrl: string;
  externalReference: string | null;
  claimType: string;
  claimSummary: string;
  observedAt: string;
  verifiedAt: string;
  retentionClass: "legal_evidence" | "prospect_research";
};

export type AssessmentSectionCandidate = {
  schemaVersion: "1.0";
  summary: string;
  items: string[];
};

export type WebsiteAssessmentCandidate = {
  businessGoal: string;
  primaryCta: string;
  sitemap: AssessmentSectionCandidate;
  homepageSections: AssessmentSectionCandidate;
  conversionPlan: AssessmentSectionCandidate;
  localSeoPlan: AssessmentSectionCandidate;
  trustSignals: AssessmentSectionCandidate;
  technologyPlan: AssessmentSectionCandidate;
  futureOpportunities: AssessmentSectionCandidate;
  heroConcept: AssessmentSectionCandidate;
  mobileFallback: AssessmentSectionCandidate;
  performanceBudget: AssessmentSectionCandidate;
};

export type FirstEmailCandidate = {
  subject: string;
  html: string;
  text: string;
  wordCount: number;
  optOutSentence: string;
  conceptDisclaimer: string;
};

export type EmailVisualCandidate = {
  assetId: null;
  fallbackAssetKey: string;
  altText: string;
  conceptDisclaimer: string;
};

export type ResearchProspectCandidate = {
  business: BusinessCandidate;
  contact: ContactCandidate;
  prospect: ProspectCandidate;
  evidence: EvidenceCandidate[];
  assessment: WebsiteAssessmentCandidate;
  firstEmail: FirstEmailCandidate;
  visual: EmailVisualCandidate;
};

export type RejectedResearchCandidate = {
  candidateName: string;
  reasonCode: string;
  sourceUrl?: string;
};

export type ResearchRunIngestion = {
  schemaVersion: "1.0";
  externalRunId: string;
  runDate: string;
  timezone: "Europe/London";
  promptVersion: string;
  prospects: ResearchProspectCandidate[];
  rejections: RejectedResearchCandidate[];
};

export type ResearchRunIngestionResult = {
  ok: true;
  runId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
  acceptedProspects: Array<{
    candidateIndex: number;
    prospectId: string;
  }>;
};
