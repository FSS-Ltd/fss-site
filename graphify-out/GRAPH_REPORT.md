# Scoped Graph Rebuild (2026-11-23)

- TARGET `35527a90fffad92e543f95aec089a40a407ce89d` is under-review; BASE `e1aaa8dd5d64924473f60a288660d530963843a6`. 501 selected committed TypeScript files, AST batches of at most 160.
- 5 colliding symbol IDs namespaced by source; 4 unresolved inferred edges omitted.
- 1193 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 501 files · ~258,859 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1581 nodes · 2933 edges · 30 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 350 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `tx()` - 22 edges
2. `GoogleGmailClient` - 17 edges
3. `held()` - 14 edges
4. `signingOperation()` - 14 edges
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
- `setUpApprovedGmailDraft()` --calls--> `createFirstEmailApprover()`  [INFERRED]
  tests/integration/growth/gmail-sync-fixtures.ts → lib/growth/sequences/approval.ts
- `POST()` --calls--> `handler()`  [INFERRED]
  app/api/agent/research-runs/route.ts → lib/growth/campaigns/command-route-handler.test.ts
- `POST()` --calls--> `createCampaignCommandHandler()`  [INFERRED]
  app/api/growth/campaigns/route.ts → lib/growth/campaigns/command-route-handler.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (64): validTransitionUsageProvenance(), GET(), createGmailClient(), classify(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations() (+56 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (48): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (43): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), requireCampaignFounder() (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (55): loadReservationAccount(), POST(), intersectAuthorityBounds(), validateCampaignAccountBinding(), offerLabel(), readEditableCampaignPolicy(), reviewCampaignReply(), createCampaignCommandHandler() (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (43): exerciseActualCronDispatch(), createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository() (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (39): POST(), insertCandidateDetails(), handler(), buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects(), runDailyResearch() (+31 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (36): formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel(), retainBranch() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (40): gmailEvidence(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential(), calculateAccessTokenExpiry() (+32 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (36): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement() (+28 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (23): PayloadTooLargeError, createFacebookReadHandler(), handler(), parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (33): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (17): appendCrmActivity(), requireCrmProspect(), tx(), CrmError, captureBusiness(), captureContact(), findCapture(), captureLead() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (15): evidence(), formatGrowthDateTime(), basis(), getCampaignReports(), jobState(), snapshot(), row(), validDate() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (7): publishCrmChange(), Component(), FakeEventSource, useGrowthEvents(), Events, item(), row()

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (29): extractResendDeliveryCandidate(), extract(), parseGmailRecipients(), parseHeader(), splitMailboxes(), encodePayload(), isSuppressed(), normaliseEmail() (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (15): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (15): PreviewChangeRequestError, request(), createPreviewChangeRequest(), PreviewPilotRequestError, validateInput(), createSignature(), isValidDraftBackfillResponse(), isValidResponse() (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.1
Nodes (10): submit(), submit(), async(), execute(), request(), push(), refresh(), activeFilterChips() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (13): scheduledFollowUpsForFirstSend(), exerciseLegacyConfirmation(), approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput() (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (7): readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), request(), cursor(), encode(), getCrmWorkspace()

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 23 - "Community 23"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (4): createFirstEmailRedrafter(), FirstEmailRedraftError, FirstEmailRedraftPersistenceError, validateRequest()

### Community 25 - "Community 25"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 26 - "Community 26"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

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
- **Thin community `Community 28`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
