# Scoped Graph Rebuild (2026-11-23)

- TARGET `e1aaa8dd5d64924473f60a288660d530963843a6` is under-review; BASE `f0708095d5beae91c4d49f632c7b219dd7aeabf4`. 490 selected committed TypeScript files, AST batches of at most 160.
- 5 colliding symbol IDs namespaced by source; 4 unresolved inferred edges omitted.
- 1156 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 490 files · ~252,042 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1549 nodes · 2860 edges · 28 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 342 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 30|Community 30]]

## God Nodes (most connected - your core abstractions)
1. `tx()` - 22 edges
2. `GoogleGmailClient` - 17 edges
3. `signingOperation()` - 14 edges
4. `held()` - 13 edges
5. `getOverviewViewModel()` - 13 edges
6. `observeGmailUsage()` - 11 edges
7. `writeAgreementContent()` - 11 edges
8. `readJson()` - 9 edges
9. `readGmailMessageMetadata()` - 9 edges
10. `writeServiceLines()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `handler()`  [INFERRED]
  app/api/cron/gmail-sync/route.ts → lib/growth/campaigns/command-route-handler.test.ts
- `run()` --calls--> `request()`  [INFERRED]
  components/portal/agreements/signing-deadline-actions.tsx → lib/growth/campaigns/command-route-handler.test.ts
- `exerciseFollowUpPreparation()` --calls--> `claimDueMessage()`  [INFERRED]
  tests/integration/growth/follow-up-preparation-assertions.ts → lib/growth/sequences/dispatcher-repository.ts
- `exerciseLegacyReservation()` --calls--> `claimDueMessage()`  [INFERRED]
  tests/integration/growth/reservation-assertions.ts → lib/growth/sequences/dispatcher-repository.ts
- `verifyResearchEmailFlow()` --calls--> `createResearchEmailApprover()`  [INFERRED]
  tests/integration/growth/research-email-flow.ts → lib/growth/sequences/research-email-approval.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (96): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+88 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (55): GET(), createGmailClient(), classify(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations(), getThreadReferences() (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (44): exerciseActualCronDispatch(), POST(), insertCandidateDetails(), handler(), buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects() (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (28): formatGbp(), completeDraft(), savedDraft(), content(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord() (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (52): validTransitionUsageProvenance(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential(), calculateAccessTokenExpiry() (+44 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (34): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (58): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), retainBranch(), assertNoPendingExecution(), insertRevision(), listAgreementRegister() (+50 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (25): PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess() (+17 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (25): appendCrmActivity(), requireCrmProspect(), tx(), async(), CrmError, businessWebsiteHost(), globalCandidateIdentityKeys(), hasRelatedWorkEmail() (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (31): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+23 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (23): submit(), submit(), save(), execute(), request(), push(), refresh(), activeFilterChips() (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (22): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (17): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout(), createEditDraftHandler(), createMessageActionHandler(), createNeedsRedraftHandler() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (7): publishCrmChange(), Component(), FakeEventSource, useGrowthEvents(), Events, item(), row()

### Community 14 - "Community 14"
Cohesion: 0.1
Nodes (26): extractResendDeliveryCandidate(), extract(), encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign() (+18 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (15): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (23): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (7): publishMonthlyReport(), runMonthlyReportBatch(), addLondonDays(), buildCampaignReport(), interval(), withinSubmissionClock(), londonDayKey()

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (16): PreviewChangeRequestError, request(), createPreviewChangeRequest(), PreviewPilotRequestError, validateInput(), createSignature(), isValidDraftBackfillResponse(), isValidResponse() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (7): readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), request(), cursor(), encode(), getCrmWorkspace()

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (7): approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit()

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 23 - "Community 23"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 24 - "Community 24"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 27 - "Community 27"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
