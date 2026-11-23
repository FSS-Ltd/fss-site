# Scoped Graph Rebuild (2026-11-23)

- TARGET `760f68020b36553142bdb187d41baf6c7fbfb44c` is under-review; BASE `01acd34ed9727892d71cf3078ffc43e16f523249`. 410 selected committed TypeScript files, AST batches of at most 160.
- 4 colliding symbol IDs namespaced by source; 6 unresolved inferred edges omitted.
- 918 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 410 files · ~211,975 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1382 nodes · 2507 edges · 25 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 314 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `GoogleGmailClient` - 17 edges
2. `createOutreachDispatcher()` - 15 edges
3. `getOverviewViewModel()` - 13 edges
4. `held()` - 11 edges
5. `observeGmailUsage()` - 11 edges
6. `writeAgreementContent()` - 11 edges
7. `signingOperation()` - 11 edges
8. `mutate()` - 9 edges
9. `readJson()` - 9 edges
10. `readGmailMessageMetadata()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `captureSourceLead()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/source-service.ts → components/growth/crm/lead-capture-form.test.tsx
- `currentVisibilityExpiry()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/account-repository.ts → components/growth/crm/facebook-source-values.test.ts
- `buildCampaignReport()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/report.ts → components/growth/crm/facebook-source-values.test.ts
- `submit()` --calls--> `refresh()`  [INFERRED]
  components/portal/agreements/agreement-lifecycle-actions.tsx → lib/growth/client/use-growth-events.test.tsx
- `loadConfiguredAccount()` --calls--> `validTransitionUsageProvenance()`  [INFERRED]
  lib/growth/campaigns/account-repository.ts → lib/growth/campaigns/account-usage.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (76): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+68 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (62): validTransitionUsageProvenance(), createGmailClient(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential() (+54 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (61): insertCandidateDetails(), buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects(), runDailyResearch(), createEditDraftHandler(), createFounderFirstEmailRevision() (+53 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (54): GET(), tx(), createOutreachDispatcher(), prepareFirstEmailSend(), prepareFollowUpSend(), recordReconciledSent(), cancelMessage(), claimDueMessage() (+46 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (59): executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), retainBranch(), assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement(), loadAgreements() (+51 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (40): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (34): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (22): formatGbp(), completeDraft(), savedDraft(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow() (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (25): PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess() (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (31): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+23 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (13): appendCrmActivity(), requireCrmProspect(), async(), CrmError, captureBusiness(), captureContact(), findCapture(), captureLead() (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (23): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+15 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (16): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (3): Events, item(), row()

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (10): submit(), publishCrmChange(), push(), activeFilterChips(), errorMessage(), run(), Component(), FakeEventSource (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.16
Nodes (20): encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign(), signUnsubscribeToken(), verifyUnsubscribeToken() (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (7): approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit()

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 19 - "Community 19"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 20 - "Community 20"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 21 - "Community 21"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 23 - "Community 23"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 24 - "Community 24"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 23`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
