# Scoped Graph Rebuild (2026-11-18)

- TARGET `1bd44edcfe156ad351ed304c28a40dca7103552b` is under-review; BASE `1bd44edcfe156ad351ed304c28a40dca7103552b`. 337 selected committed TypeScript files, AST batches of at most 160.
- 4 colliding symbol IDs namespaced by source; 7 unresolved inferred edges omitted.
- 720 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-18)

## Corpus Check
- 337 files · ~165,388 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1185 nodes · 2125 edges · 29 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 284 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 31|Community 31]]

## God Nodes (most connected - your core abstractions)
1. `GoogleGmailClient` - 16 edges
2. `createOutreachDispatcher()` - 15 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `observeGmailUsage()` - 11 edges
6. `text()` - 11 edges
7. `writeAgreementContent()` - 11 edges
8. `held()` - 10 edges
9. `writeServiceLines()` - 10 edges
10. `mutate()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `text()`  [INFERRED]
  scripts/refresh-pending-first-email-drafts.ts → lib/growth/research/global-schema.ts
- `POST()` --calls--> `createFacebookDiscoveryHandler()`  [INFERRED]
  app/api/agent/facebook-discovery/route.ts → lib/growth/facebook/discovery-route-handler.ts
- `GET()` --calls--> `createGrowthEventHandler()`  [INFERRED]
  app/api/growth/events/route.ts → lib/growth/facebook/event-route-handler.ts
- `submit()` --calls--> `refresh()`  [INFERRED]
  components/portal/agreements/agreement-lifecycle-actions.tsx → lib/growth/client/use-growth-events.test.tsx
- `run()` --calls--> `request()`  [INFERRED]
  components/portal/agreements/signing-deadline-actions.tsx → lib/growth/facebook/event-route-handler.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (40): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (68): resendStaffAgreementNotification(), createPreviewChangeRequest(), PreviewPilotRequestError, tx(), validateInput(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer() (+60 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (48): insertCandidateDetails(), request(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError, requireParagraphs(), requireRetainedStandards(), requireSingleLineText(), ResearchIngestionError (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (48): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+40 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (47): validTransitionUsageProvenance(), createGmailClient(), discardBody(), GoogleGmailClient, providerError(), readJson(), requireCredential(), buildGoogleAuthorizationUrl() (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (23): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), validateRequest(), createApproveSendHandler(), createPreviewChangeRequestRouteHandler() (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (20): GET(), hasCompleteReplyCoverage(), commitReplyCoverage(), loadReplyCoverage(), loadReplySyncState(), createGmailReplySync(), emptySummary(), createFakeGmailClient() (+12 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (32): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (18): formatGbp(), formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (9): submit(), publishCrmChange(), Component(), FakeEventSource, refresh(), useGrowthEvents(), Events, item() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (15): appendCrmActivity(), requireCrmProspect(), CrmError, captureBusiness(), captureContact(), findCapture(), captureLead(), attachCrmContact() (+7 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (12): POST(), createFacebookDiscoveryHandler(), PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), executeFacebookCommand() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (25): createOutreachDispatcher(), prepareFirstEmailSend(), prepareFollowUpSend(), recordReconciledSent(), cancelMessage(), claimDueMessage(), failMessage(), getFollowUpTemplate() (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (20): encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign(), signUnsubscribeToken(), verifyUnsubscribeToken() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (8): GET(), createGrowthEventHandler(), request(), readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), errorMessage(), run()

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (5): calculateAccessTokenExpiry(), connectGmail(), GmailConnectionError, requireNonBlank(), IntegrationConnectionPersistenceError

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (7): buildCampaignCopy(), buildCampaignSubject(), safe(), addLondonDays(), buildCampaignReport(), interval(), londonDayKey()

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
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 22 - "Community 22"
Cohesion: 0.42
Nodes (8): fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed(), getMessageReview(), isFallbackKey(), resolveVisualForPreview()

### Community 23 - "Community 23"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 24 - "Community 24"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 26 - "Community 26"
Cohesion: 0.43
Nodes (4): findEligibleDraftIds(), main(), readDatabaseUrl(), refreshDraft()

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 28 - "Community 28"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 27`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
