# Scoped Graph Rebuild (2026-11-23)

- TARGET `f0708095d5beae91c4d49f632c7b219dd7aeabf4` is under-review; BASE `03d99dc9973278450cb3d9a0565c8eb1a9939633`. 468 selected committed TypeScript files, AST batches of at most 160.
- 4 colliding symbol IDs namespaced by source; 5 unresolved inferred edges omitted.
- 1106 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 468 files · ~241,785 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1506 nodes · 2785 edges · 28 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 339 edges (avg confidence: 0.8)
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
1. `GoogleGmailClient` - 17 edges
2. `tx()` - 17 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `observeGmailUsage()` - 11 edges
6. `writeAgreementContent()` - 11 edges
7. `mutate()` - 10 edges
8. `requireCampaignFounder()` - 9 edges
9. `readJson()` - 9 edges
10. `readGmailMessageMetadata()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `request()`  [INFERRED]
  components/portal/agreements/signing-deadline-actions.tsx → app/api/cron/outreach-prepare/route.test.ts
- `verifyResearchEmailFlow()` --calls--> `createResearchEmailApprover()`  [INFERRED]
  tests/integration/growth/research-email-flow.ts → lib/growth/sequences/research-email-approval.ts
- `async()` --calls--> `run()`  [INFERRED]
  components/growth/crm/command-form.tsx → components/portal/agreements/signing-deadline-actions.tsx
- `currentVisibilityExpiry()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/account-repository.ts → components/growth/crm/facebook-source-values.test.ts
- `buildCampaignReport()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/report.ts → components/growth/crm/facebook-source-values.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (91): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+83 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (47): GET(), createGmailClient(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations(), prepareLegacyMessage(), runFirstPreparationBatch() (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (42): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (61): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), retainBranch(), assertNoPendingExecution(), insertRevision(), listAgreementRegister() (+53 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (43): insertCandidateDetails(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError, requireParagraphs(), requireRetainedStandards(), requireSingleLineText(), ResearchIngestionError, InvalidStoredFirstEmailDraftError (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (43): validTransitionUsageProvenance(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential(), loadReplySyncState() (+35 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (36): exerciseActualCronDispatch(), createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository() (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (34): buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects(), runDailyResearch(), PayloadTooLargeError, readRawBody(), createFacebookReadHandler() (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (17): formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel(), formatMoney() (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (14): submit(), publishCrmChange(), push(), refresh(), activeFilterChips(), request(), errorMessage(), run() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (31): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (17): appendCrmActivity(), requireCrmProspect(), tx(), async(), CrmError, captureBusiness(), captureContact(), findCapture() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (18): offerLabel(), createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment() (+10 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (29): extractResendDeliveryCandidate(), extract(), parseGmailRecipients(), parseHeader(), splitMailboxes(), encodePayload(), isSuppressed(), normaliseEmail() (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (18): fetchAuditSummary(), fetchCoreRow(), fetchEvidence(), getProspectDetail(), toProspectDetail(), buildFilterFragments(), decodeProspectCursor(), encodeProspectCursor() (+10 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (15): PreviewChangeRequestError, request(), createPreviewChangeRequest(), PreviewPilotRequestError, validateInput(), createSignature(), isValidDraftBackfillResponse(), isValidResponse() (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (12): exerciseLegacyConfirmation(), approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (18): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (7): readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), request(), cursor(), encode(), getCrmWorkspace()

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (5): calculateAccessTokenExpiry(), connectGmail(), GmailConnectionError, requireNonBlank(), IntegrationConnectionPersistenceError

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

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
