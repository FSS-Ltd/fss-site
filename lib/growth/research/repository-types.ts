import type { GrowthDb } from "../db/types";
import type {
  ResearchProspectCandidate,
  ResearchRunIngestion,
  ResearchRunIngestionResult,
} from "./types";

export type ResearchRunRecord = {
  id: string;
  externalRunId: string;
  accepted: number;
  duplicates: number;
  rejected: number;
};

export type CandidateInspection =
  | { kind: "accept" }
  | { kind: "duplicate_business" }
  | { kind: "duplicate_contact" }
  | { kind: "suppressed_contact" };

export type InsertedResearchCandidate = {
  businessId: string;
  contactId: string;
  prospectId: string;
};

export type ResearchVisualSelection = {
  kind: "fallback";
  fallbackAssetKey: string;
  pathname: string;
  sha256: string;
  altText: string;
  conceptDisclaimer: string;
};

export type CompleteRunCounts = {
  accepted: number;
  duplicates: number;
  rejected: number;
};

export type InsertCandidateDetailsInput = {
  runId: string;
  candidateIndex: number;
  candidate: ResearchProspectCandidate;
  inserted: InsertedResearchCandidate;
  visual: ResearchVisualSelection;
  externalRunId: string;
  promptVersion: string;
};

export interface ResearchIngestionTransaction {
  lockExternalRun(externalRunId: string): Promise<void>;
  findRunResult(
    externalRunId: string,
  ): Promise<ResearchRunIngestionResult | null>;
  lockCandidateIdentities(
    candidates: readonly ResearchProspectCandidate[],
  ): Promise<void>;
  insertRun(input: ResearchRunIngestion): Promise<string>;
  inspectCandidate(
    candidate: ResearchProspectCandidate,
  ): Promise<CandidateInspection>;
  insertCandidateCore(input: {
    runId: string;
    candidate: ResearchProspectCandidate;
  }): Promise<InsertedResearchCandidate>;
  insertCandidateDetails(input: InsertCandidateDetailsInput): Promise<void>;
  appendProspectAuditEvent(input: {
    externalRunId: string;
    prospectId: string;
    fitScore: number;
  }): Promise<void>;
  completeRun(runId: string, counts: CompleteRunCounts): Promise<void>;
  appendRunAuditEvent(input: {
    externalRunId: string;
    runId: string;
  }): Promise<void>;
  readRunResult(runId: string): Promise<ResearchRunIngestionResult>;
}

export interface ResearchIngestionRepository {
  withTransaction<T>(
    db: GrowthDb,
    operation: (transaction: ResearchIngestionTransaction) => Promise<T>,
  ): Promise<T>;
}
