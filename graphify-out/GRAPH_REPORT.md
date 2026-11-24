# Scoped Graph Rebuild (2026-11-24)

- TARGET `b8f638c12cc069f3647edb857a7b9a4086f51469` is under-review; BASE `5fcd4e8e048a96422030d5d5d7ee3118e72cc5b0`. 573 selected committed TypeScript files, AST batches of at most 160.
- 5 colliding symbol IDs namespaced by source; 5 unresolved inferred edges omitted.
- 1466 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-24)

## Corpus Check
- 573 files · ~309,661 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1780 nodes · 3412 edges · 30 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 403 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `held()` - 22 edges
2. `GoogleGmailClient` - 17 edges
3. `getOverviewViewModel()` - 13 edges
4. `loadControlledPreparation()` - 11 edges
5. `classifyGmailRoutingInTransaction()` - 11 edges
6. `writeAgreementContent()` - 11 edges
7. `signingOperation()` - 11 edges
8. `refresh()` - 10 edges
9. `observeGmailUsage()` - 10 edges
10. `lockedPreparation()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `handler()`  [INFERRED]
  app/api/cron/gmail-sync/route.ts → lib/growth/campaigns/account-command-route-handler.test.ts
- `gmail()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/account-command-route-handler.test.ts → components/growth/crm/lead-capture-form.test.tsx
- `resend()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/account-command-route-handler.test.ts → components/growth/crm/lead-capture-form.test.tsx
- `run()` --calls--> `request()`  [INFERRED]
  components/portal/agreements/signing-deadline-actions.tsx → lib/growth/campaigns/account-command-route-handler.test.ts
- `POST()` --calls--> `handler()`  [INFERRED]
  app/api/agent/research-runs/route.ts → lib/growth/campaigns/account-command-route-handler.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (92): createAccountCommandHandler(), executeAccountControlCommand(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount(), POST(), requireCampaignFounder(), exerciseDirectProofRace() (+84 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (60): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+52 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (66): resendStaffAgreementNotification(), tx(), retainBranch(), text(), lockGmailRouting(), lockGmailThread(), assertNoPendingExecution(), insertRevision() (+58 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (55): validTransitionUsageProvenance(), createGmailClient(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential() (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (34): gmail(), request(), resend(), submit(), submit(), nullable(), number(), value() (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (37): GET(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations(), prepareLegacyMessage(), scheduledFollowUpsForFirstSend(), loadProvenReferenceRows() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (50): offerLabel(), applyReplyReview(), exerciseCampaignReplyReview(), reviewCampaignReply(), createCampaignCommandHandler(), handler(), mutate(), buildControlledFirstMessage() (+42 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (46): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+38 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (32): handler(), exerciseActualCronDispatch(), POST(), insertCandidateDetails(), buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects() (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (23): PayloadTooLargeError, createFacebookReadHandler(), handler(), parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (31): getThreadReferences(), InvalidStoredFirstEmailDraftError, parseStoredFirstEmailDraft(), sameFirstEmailCandidate(), FirstEmailTemplateRefreshError, refreshFirstEmailTemplate(), hasCompleteReplyCoverage(), loadReplyCoverage() (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (17): currentVisibilityExpiry(), appendCrmActivity(), requireCrmProspect(), CrmError, values(), createFounderVerificationHandler(), handler(), captureBusiness() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (7): publishCrmChange(), Component(), FakeEventSource, useGrowthEvents(), Events, item(), row()

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (29): db(), buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount() (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (21): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (26): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.1
Nodes (14): basis(), getCampaignReports(), jobState(), snapshot(), row(), validDate(), validModernWinner(), validReport() (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (15): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (10): readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), PayloadTooLargeError, readJsonRequestBody(), text(), request(), cursor() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (11): encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign(), signUnsubscribeToken(), verifyUnsubscribeToken() (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (7): approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit()

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 22 - "Community 22"
Cohesion: 0.26
Nodes (11): createSignature(), isValidDraftBackfillResponse(), isValidResponse(), triggerCurrentTenDraftPreviewBackfill(), triggerCurrentTenPreviewPullRequest(), triggerCurrentThirteenEvidenceRefresh(), triggerPreviewPullRequest(), triggerScheduledPreviewPullRequest() (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 24 - "Community 24"
Cohesion: 0.39
Nodes (4): getExactReplies(), getProspectCampaignReplies(), reviewKind(), read()

### Community 25 - "Community 25"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (2): readBoundedResendJson(), readResendUsage()

### Community 29 - "Community 29"
Cohesion: 0.6
Nodes (3): assessAccountReadiness(), count(), validTime()

### Community 30 - "Community 30"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (8 nodes): `outreach-transport.test.ts`, `outreach-transport.ts`, `usage.test.ts`, `usage.ts`, `createResendOutreachTransport()`, `readBoundedResendJson()`, `readResendUsage()`, `payload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
