# Scoped Graph Rebuild (2026-11-18)

- TARGET `d4e41eb6b7e7a68047733a646be94666bd35c065` is under-review; BASE `df44ef7c91626750b8649b3486d7a19532fcdb4e`. 376 selected committed TypeScript files, AST batches of at most 160.
- 4 colliding symbol IDs namespaced by source; 7 unresolved inferred edges omitted.
- 827 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-18)

## Corpus Check
- 376 files · ~191,368 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1297 nodes · 2300 edges · 32 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 268 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 34|Community 34]]

## God Nodes (most connected - your core abstractions)
1. `GoogleGmailClient` - 16 edges
2. `createOutreachDispatcher()` - 15 edges
3. `getOverviewViewModel()` - 13 edges
4. `observeGmailUsage()` - 11 edges
5. `writeAgreementContent()` - 11 edges
6. `signingOperation()` - 11 edges
7. `held()` - 10 edges
8. `tx()` - 10 edges
9. `text()` - 10 edges
10. `mutate()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `submit()` --calls--> `refresh()`  [INFERRED]
  components/portal/agreements/agreement-lifecycle-actions.tsx → lib/growth/client/use-growth-events.test.tsx
- `loadConfiguredAccount()` --calls--> `validTransitionUsageProvenance()`  [INFERRED]
  lib/growth/campaigns/account-repository.ts → lib/growth/campaigns/account-usage.ts
- `insertObservation()` --calls--> `tx()`  [INFERRED]
  lib/growth/facebook/service.ts → lib/growth/prospect-previews/change-requests.test.ts
- `createPreviewChangeRequestRouteHandler()` --calls--> `createMessageActionHandler()`  [INFERRED]
  lib/growth/prospect-previews/change-request-route-handler.ts → lib/growth/sequences/message-action-route.ts
- `insertCandidateDetails()` --calls--> `tx()`  [INFERRED]
  lib/growth/research/candidate-details.ts → lib/growth/prospect-previews/change-requests.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (44): formatGbp(), formatGbp(), completeDraft(), savedDraft(), content(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal() (+36 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (53): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+45 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (42): insertCandidateDetails(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError, requireParagraphs(), requireRetainedStandards(), requireSingleLineText(), ResearchIngestionError, InvalidStoredFirstEmailDraftError (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (45): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), validateRequest(), createApproveSendHandler(), createHandler() (+37 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (31): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (48): validTransitionUsageProvenance(), discardBody(), GoogleGmailClient, providerError(), readJson(), requireCredential(), hasCompleteReplyCoverage(), commitReplyCoverage() (+40 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (31): GET(), createGmailClient(), parseGmailReferences(), assessGmailRouting(), gmailFromAddress(), classifyGmailRoutingInTransaction(), validateGmailEffectObservation(), validateGmailObservation() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (33): resendStaffAgreementNotification(), finaliseDraft(), tx(), assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement(), loadAgreements() (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (28): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (9): submit(), publishCrmChange(), Component(), FakeEventSource, refresh(), useGrowthEvents(), Events, item() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (26): retainBranch(), readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), PayloadTooLargeError, readJsonRequestBody(), text(), signingPounds() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (15): appendCrmActivity(), requireCrmProspect(), CrmError, captureBusiness(), captureContact(), findCapture(), captureLead(), attachCrmContact() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (11): PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), executeFacebookCommand(), FacebookError, hash() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (15): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (20): encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign(), signUnsubscribeToken(), verifyUnsubscribeToken() (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (5): calculateAccessTokenExpiry(), connectGmail(), GmailConnectionError, requireNonBlank(), IntegrationConnectionPersistenceError

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (7): approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit()

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (5): createPreviewChangeRequestRouteHandler(), PreviewChangeRequestError, createPreviewChangeRequest(), PreviewPilotRequestError, validateInput()

### Community 21 - "Community 21"
Cohesion: 0.24
Nodes (8): parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess(), buildAgentPrompt(), buildFailureReport(), buildWeekdayExternalRunId(), executeScheduledResearchAgent(), londonDate()

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (8): createApprover(), createFakeRepository(), createFakeState(), email(), fakeGmailClient(), fallbackVisual(), lockedDraft(), words()

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
Cohesion: 0.33
Nodes (3): createSequenceResumer(), SequenceResumeError, validateRequest()

### Community 29 - "Community 29"
Cohesion: 0.7
Nodes (3): buildCampaignCopy(), buildCampaignSubject(), safe()

### Community 30 - "Community 30"
Cohesion: 0.4
Nodes (1): ProspectPreviewApprovalPersistenceError

### Community 31 - "Community 31"
Cohesion: 0.83
Nodes (3): describeSourcePackageStatus(), hasReadyPreviewSource(), resolveReadyBespokePreviewSlug()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (2): listStudioClients(), parseSearch()

## Knowledge Gaps
- **4 isolated node(s):** `PayloadTooLargeError`, `UsageHold`, `PayloadTooLargeError`, `InvalidFirstEmailRevisionContentError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 30`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
