# Scoped Graph Rebuild (2026-11-17)

- Persistent graph/extraction rebuilt at reviewed revision `709f16bfa` from 235 selected TypeScript sources in 2 local Graphify AST batches (each at most 160 files): 889 nodes and 1589 edges.
- Installed Graphify omits cross-file static imports in this environment; supplemented 483 selected-file imports using the installed TypeScript compiler, with actual source lines and EXTRACTED confidence 1. Zero model tokens or external upload. No unreviewed working changes included.
- Source paths and the canonical CRM/source-service import check passed. Communities/cohesion are current, with generic algorithmic labels. Coverage remains selected Growth/Studio/agreement scopes, not the whole repository; SQL, docs, styles, most routes/TSX and dynamic imports are outside extraction. Exact corpus/hashes in source-hashes.json. Historical graph.html/benchmark.json remain unchanged by this no-viz pass.

# Graph Report - .  (2026-11-17)

## Corpus Check
- 235 files · ~102,824 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 889 nodes · 1589 edges · 23 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 208 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `GoogleGmailClient` - 15 edges
2. `createOutreachDispatcher()` - 14 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `writeAgreementContent()` - 11 edges
6. `GET()` - 10 edges
7. `readGmailMessageMetadata()` - 9 edges
8. `writeServiceLines()` - 9 edges
9. `contentFromForm()` - 8 edges
10. `hasCompleteSigningEvidence()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `textValue()` --calls--> `GET()`  [INFERRED]
  components/portal/agreements/agreement-builder-step-support.tsx → app/api/cron/operations-dispatch/route.ts
- `buildCampaignReport()` --calls--> `GET()`  [INFERRED]
  lib/growth/campaigns/report.ts → app/api/cron/operations-dispatch/route.ts
- `selectDefaultWorkQueueTab()` --calls--> `GET()`  [INFERRED]
  lib/growth/dashboard/overview.ts → app/api/cron/operations-dispatch/route.ts
- `requestHasRegisteredOrigin()` --calls--> `GET()`  [INFERRED]
  lib/growth/http/founder-request.ts → app/api/cron/operations-dispatch/route.ts
- `readJson()` --calls--> `GET()`  [INFERRED]
  lib/growth/integrations/gmail/client.ts → app/api/cron/operations-dispatch/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (33): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (30): readCommercialOffer(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError, requireParagraphs(), requireRetainedStandards(), requireSingleLineText(), ResearchIngestionError, FirstEmailRevisionError (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (27): createGmailClient(), discardBody(), GoogleGmailClient, providerError(), readJson(), requireCredential(), createGmailReplySync(), emptySummary() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (25): appendCrmActivity(), requireCrmProspect(), requireCampaignFounder(), executeCampaignCommand(), mutate(), CrmError, appendCampaignEventAndOutbox(), loadFounderVerification() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (36): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement() (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (36): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), createTransaction(), FirstEmailApprovalPersistenceError, ProspectPreviewApprovalPersistenceError, toJsonValue(), resolveVisual() (+28 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (34): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (13): completeDraft(), savedDraft(), content(), recurringDraft(), agreementDraft(), createAgreementRouteHandler(), setup(), errorMessage() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (27): InvalidStoredFirstEmailDraftError, parseStoredFirstEmailDraft(), sameFirstEmailCandidate(), FirstEmailTemplateRefreshError, refreshFirstEmailTemplate(), getUrlHostname(), isGoogleMapsReferenceUrl(), isHttpUrl() (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (13): formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel(), clientSigningProgress() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.1
Nodes (24): createSequenceStopper(), resolveActor(), SequenceStopError, validateRequest(), encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint() (+16 more)

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (18): fetchAuditSummary(), fetchCoreRow(), fetchEvidence(), getProspectDetail(), toProspectDetail(), buildFilterFragments(), decodeProspectCursor(), encodeProspectCursor() (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (21): calculateAccessTokenExpiry(), connectGmail(), GmailConnectionError, requireNonBlank(), buildGoogleAuthorizationUrl(), exchangeGoogleAuthorizationCode(), fetchGoogleIdentity(), GoogleOAuthError (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (23): retainBranch(), signingPounds(), writeAgreementContent(), writeExecutionRecord(), writeRevenueShare(), writeServiceLines(), ensureSigningSpace(), finishSigningPdf() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (18): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+10 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (7): buildCampaignCopy(), buildCampaignSubject(), safe(), addLondonDays(), buildCampaignReport(), interval(), londonDayKey()

### Community 16 - "Community 16"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (8): parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport(), buildWeekdayExternalRunId(), executeScheduledResearchAgent(), londonDate()

### Community 19 - "Community 19"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 20 - "Community 20"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 21 - "Community 21"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **3 isolated node(s):** `PayloadTooLargeError`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 24`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.