# Scoped Graph Rebuild (2026-11-23)

- TARGET `c9ea3d6e25046f0ea1a7d37dbe1d2cdcc733d4e4` is under-review; BASE `35527a90fffad92e543f95aec089a40a407ce89d`. 521 selected committed TypeScript files, AST batches of at most 160.
- 5 colliding symbol IDs namespaced by source; 4 unresolved inferred edges omitted.
- 1268 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 521 files · ~273,011 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1640 nodes · 3087 edges · 31 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 385 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `tx()` - 25 edges
2. `held()` - 19 edges
3. `GoogleGmailClient` - 17 edges
4. `signingOperation()` - 14 edges
5. `getOverviewViewModel()` - 13 edges
6. `observeGmailUsage()` - 11 edges
7. `writeAgreementContent()` - 11 edges
8. `text()` - 10 edges
9. `writeServiceLines()` - 10 edges
10. `readJson()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `request()`  [INFERRED]
  components/portal/agreements/signing-deadline-actions.tsx → lib/growth/campaigns/command-route-handler.test.ts
- `GET()` --calls--> `handler()`  [INFERRED]
  app/api/cron/gmail-sync/route.ts → lib/growth/campaigns/command-route-handler.test.ts
- `main()` --calls--> `text()`  [INFERRED]
  scripts/refresh-pending-first-email-drafts.ts → lib/growth/research/global-schema.ts
- `exerciseActualCronDispatch()` --calls--> `createResearchEmailSendHandler()`  [INFERRED]
  tests/integration/growth/actual-cron-dispatch.ts → lib/growth/sequences/research-email-send-route.ts
- `POST()` --calls--> `handler()`  [INFERRED]
  app/api/agent/research-runs/route.ts → lib/growth/campaigns/command-route-handler.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (92): executeAccountControlCommand(), loadConfiguredAccountReadiness(), loadReservationAccount(), intersectAuthorityBounds(), requireCampaignFounder(), validateCampaignAccountBinding(), offerLabel(), reviewCampaignReply() (+84 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (58): GET(), createGmailClient(), classify(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations(), getThreadReferences() (+50 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (66): submit(), resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), retainBranch(), text(), assertNoPendingExecution() (+58 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (40): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (54): validTransitionUsageProvenance(), gmailEvidence(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential() (+46 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (41): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+33 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (34): exerciseActualCronDispatch(), insertCandidateDetails(), buildDailyResearchRunId(), publish(), readPrivate(), runDailyResearch(), seedProspectWithDraft(), ResearchIngestionError (+26 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (36): assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), appendCrmActivity(), requireCrmProspect(), tx() (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.03
Nodes (28): PreviewChangeRequestError, request(), createPreviewChangeRequest(), PreviewPilotRequestError, validateInput(), PayloadTooLargeError, readRawBody(), createFacebookReadHandler() (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (18): formatGbp(), formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (33): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (26): POST(), POST(), createCampaignCommandHandler(), execute(), handler(), request(), push(), fetchAuditSummary() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (7): publishCrmChange(), Component(), FakeEventSource, useGrowthEvents(), Events, item(), row()

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (26): extractResendDeliveryCandidate(), extract(), encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign() (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (9): evidence(), submit(), submit(), save(), formatGrowthDateTime(), " "(), enrol(), refresh() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (15): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (11): basis(), getCampaignReports(), jobState(), snapshot(), row(), validDate(), validReport(), addLondonDays() (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (18): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (7): readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), request(), cursor(), encode(), getCrmWorkspace()

### Community 19 - "Community 19"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (7): approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit()

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 22 - "Community 22"
Cohesion: 0.24
Nodes (8): parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport(), buildWeekdayExternalRunId(), executeScheduledResearchAgent(), londonDate()

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (11): request(), createSignature(), isValidDraftBackfillResponse(), isValidResponse(), triggerCurrentTenDraftPreviewBackfill(), triggerCurrentTenPreviewPullRequest(), triggerCurrentThirteenEvidenceRefresh(), triggerPreviewPullRequest() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (2): publishMonthlyReport(), runMonthlyReportBatch()

### Community 25 - "Community 25"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 26 - "Community 26"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 27 - "Community 27"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 29 - "Community 29"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 30 - "Community 30"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 24`** (11 nodes): `route.ts`, `GET()`, `isLondonSummarySlot()`, `daily-runs.test.ts`, `daily-runs.ts`, `monthly-report-worker.ts`, `seedMonthlyReport()`, `publishMonthlyReport()`, `runMonthlyReportBatch()`, `monthly-report-fixture.ts`, `monthly-report-worker.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
