# Scoped Graph Rebuild (2026-11-24)

- TARGET `962c0d0e412ff0941dbe7ac55266a23b924b4ab9` is under-review; BASE `f214745aceaf1719dc588906f62af902b8e0e120`. 571 selected committed TypeScript files, AST batches of at most 160.
- 5 colliding symbol IDs namespaced by source; 5 unresolved inferred edges omitted.
- 1460 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-24)

## Corpus Check
- 571 files · ~308,531 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1776 nodes · 3422 edges · 30 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 421 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `held()` - 22 edges
2. `GoogleGmailClient` - 17 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `loadControlledPreparation()` - 11 edges
6. `classifyGmailRoutingInTransaction()` - 11 edges
7. `writeAgreementContent()` - 11 edges
8. `refresh()` - 10 edges
9. `observeGmailUsage()` - 10 edges
10. `tx()` - 10 edges

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
Nodes (76): executeAccountControlCommand(), requireCampaignFounder(), exerciseCampaignReplyReview(), controlledCopyFamilyFingerprint(), loadControlledPreparation(), exerciseDirectProofRace(), matchesDirectSubmissionEvidence(), persistOutcome() (+68 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (46): GET(), createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), validateRequest(), createGmailClient() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (84): resendStaffAgreementNotification(), AgreementBuilderDraftConflict, draftConflict(), finaliseDraft(), loadStaffAgreementBuilderDraft(), saveStaffAgreementBuilderDraft(), toAgreementDraft(), tx() (+76 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (52): createAccountCommandHandler(), handler(), POST(), POST(), insertCandidateDetails(), buildDailyResearchRunId(), publish(), readPrivate() (+44 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (50): loadExactReplyReviewContext(), submit(), offerLabel(), submit(), applyReplyReview(), reviewCampaignReply(), submit(), " "() (+42 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (64): discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential(), getThreadReferences(), calculateAccessTokenExpiry() (+56 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (37): formatGbp(), formatGbp(), agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), ClientAgreementDetail(), CompletionNotice() (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (34): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (17): submit(), nullable(), number(), value(), evidence(), CampaignDailySummary(), getCampaignDailySummary(), submit() (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (24): createApproveSendHandler(), createHandler(), createPreviewChangeRequestRouteHandler(), PreviewChangeRequestError, createPreviewChangeRequest(), PreviewPilotRequestError, validateInput(), classifyProviderError() (+16 more)

### Community 10 - "Community 10"
Cohesion: 0.04
Nodes (23): PayloadTooLargeError, createFacebookReadHandler(), handler(), parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport() (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (17): appendCrmActivity(), requireCrmProspect(), CrmError, readJsonRequestBody(), createFounderVerificationHandler(), handler(), captureBusiness(), captureContact() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (25): db(), buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount() (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (20): exerciseActualCronDispatch(), assertDisposableGrowthDatabase(), withGrowthLogin(), createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (7): publishCrmChange(), Component(), FakeEventSource, useGrowthEvents(), Events, item(), row()

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (28): parseGmailReferences(), classifyResendOutreachAdverse(), classify(), extractResendDeliveryCandidate(), extract(), encodePayload(), isSuppressed(), normaliseEmail() (+20 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (14): basis(), getCampaignReports(), jobState(), snapshot(), row(), validDate(), validModernWinner(), validReport() (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (10): gmail(), request(), resend(), submit(), Source, async(), push(), activeFilterChips() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (9): assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount(), validTransitionUsageProvenance() (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (12): scheduledFollowUpsForFirstSend(), approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit() (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.24
Nodes (12): createSignature(), isValidDraftBackfillResponse(), isValidResponse(), triggerCurrentTenDraftPreviewBackfill(), triggerCurrentTenPreviewPullRequest(), triggerCurrentThirteenEvidenceRefresh(), triggerPreviewPullRequest(), triggerScheduledPreviewPullRequest() (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (8): createApprover(), createFakeRepository(), createFakeState(), email(), fakeGmailClient(), fallbackVisual(), lockedDraft(), words()

### Community 24 - "Community 24"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (2): canSendBatchDraft(), sendBatchDraft()

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (2): readBoundedResendJson(), readResendUsage()

### Community 28 - "Community 28"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 29 - "Community 29"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (6 nodes): `canSendBatchDraft()`, `loadBatchDraft()`, `sendBatchDraft()`, `entry()`, `batch-draft-review.test.ts`, `batch-draft-review.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (5 nodes): `usage.test.ts`, `usage.ts`, `readBoundedResendJson()`, `readResendUsage()`, `payload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
