# Scoped Graph Rebuild (2026-11-18)

- Persistent graph/extraction rebuilt at reviewed revision `97ab9ec0f` from 297 selected TypeScript sources in 2 local Graphify AST batches (each at most 160 files): 1057 nodes and 1881 edges.
- Installed Graphify omits cross-file static imports in this environment; supplemented 591 selected-file imports using the installed TypeScript compiler, with actual source lines and EXTRACTED confidence 1. Zero model tokens or external upload. No unreviewed working changes included.
- Source paths and the canonical CRM/source-service import check passed. Communities/cohesion are current, with generic algorithmic labels. Coverage remains selected Growth/Studio/agreement scopes, not the whole repository; SQL, docs, styles, most routes/TSX and dynamic imports are outside extraction. Exact corpus/hashes in source-hashes.json. Historical graph.html/benchmark.json remain unchanged by this no-viz pass.

# Graph Report - .  (2026-11-18)

## Corpus Check
- 297 files · ~136,504 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1057 nodes · 1881 edges · 28 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 263 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 30|Community 30]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 15 edges
2. `GoogleGmailClient` - 15 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `readJson()` - 12 edges
6. `createOutreachDispatcher()` - 12 edges
7. `writeAgreementContent()` - 11 edges
8. `requireCampaignFounder()` - 10 edges
9. `held()` - 10 edges
10. `text()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `createGrowthEventHandler()`  [INFERRED]
  app/api/growth/facebook/route.ts → lib/growth/facebook/event-route-handler.ts
- `CommandForm()` --calls--> `GET()`  [INFERRED]
  components/growth/facebook/command-form.tsx → app/api/growth/facebook/route.ts
- `textValue()` --calls--> `GET()`  [INFERRED]
  components/portal/agreements/agreement-builder-step-support.tsx → app/api/growth/facebook/route.ts
- `readCommercialOffer()` --calls--> `GET()`  [INFERRED]
  components/portal/agreements/commercial-offer-fields.tsx → app/api/growth/facebook/route.ts
- `buildCampaignReport()` --calls--> `GET()`  [INFERRED]
  lib/growth/campaigns/report.ts → app/api/growth/facebook/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (29): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (27): formatGbp(), completeDraft(), savedDraft(), content(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord() (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (38): insertCandidateDetails(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError, requireParagraphs(), requireRetainedStandards(), requireSingleLineText(), ResearchIngestionError, InvalidStoredFirstEmailDraftError (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (51): resendStaffAgreementNotification(), AgreementBuilderDraftConflict, draftConflict(), finaliseDraft(), loadStaffAgreementBuilderDraft(), saveStaffAgreementBuilderDraft(), toAgreementDraft(), tx() (+43 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (39): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount(), sameAccountScopes() (+31 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (29): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), createTransaction(), FirstEmailApprovalPersistenceError, ProspectPreviewApprovalPersistenceError, toJsonValue(), resolveVisual() (+21 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (22): createGmailClient(), discardBody(), GoogleGmailClient, providerError(), readJson(), requireCredential(), getConnectedGmailCredential(), IntegrationConnectionPersistenceError (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (32): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+24 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (21): CommandForm(), createGrowthEventHandler(), readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), PayloadTooLargeError, readJsonRequestBody(), readRequestHasRegisteredOrigin() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (17): appendCrmActivity(), requireCrmProspect(), CrmError, captureBusiness(), captureContact(), findCapture(), captureLead(), attachCrmContact() (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (9): submit(), publishCrmChange(), Component(), FakeEventSource, refresh(), useGrowthEvents(), Events, item() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (22): createOutreachDispatcher(), prepareFirstEmailSend(), prepareFollowUpSend(), recordReconciledSent(), cancelMessage(), claimDueMessage(), failMessage(), getFollowUpTemplate() (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (18): fetchAuditSummary(), fetchCoreRow(), fetchEvidence(), getProspectDetail(), toProspectDetail(), buildFilterFragments(), decodeProspectCursor(), encodeProspectCursor() (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (24): createSequenceStopper(), resolveActor(), SequenceStopError, validateRequest(), encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint() (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (14): calculateAccessTokenExpiry(), connectGmail(), GmailConnectionError, requireNonBlank(), buildGoogleAuthorizationUrl(), exchangeGoogleAuthorizationCode(), fetchGoogleIdentity(), GoogleOAuthError (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (18): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (7): buildCampaignCopy(), buildCampaignSubject(), safe(), addLondonDays(), buildCampaignReport(), interval(), londonDayKey()

### Community 17 - "Community 17"
Cohesion: 0.36
Nodes (16): text(), signingPounds(), writeAgreementContent(), writeExecutionRecord(), writeRevenueShare(), writeServiceLines(), ensureSigningSpace(), finishSigningPdf() (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 20 - "Community 20"
Cohesion: 0.24
Nodes (8): parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport(), buildWeekdayExternalRunId(), executeScheduledResearchAgent(), londonDate()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (11): request(), createSignature(), isValidDraftBackfillResponse(), isValidResponse(), triggerCurrentTenDraftPreviewBackfill(), triggerCurrentTenPreviewPullRequest(), triggerCurrentThirteenEvidenceRefresh(), triggerPreviewPullRequest() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 23 - "Community 23"
Cohesion: 0.42
Nodes (8): fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed(), getMessageReview(), isFallbackKey(), resolveVisualForPreview()

### Community 24 - "Community 24"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 27 - "Community 27"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **3 isolated node(s):** `PayloadTooLargeError`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 30`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.