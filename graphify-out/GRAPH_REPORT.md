# Scoped Graph Rebuild (2026-11-23)

- TARGET `716cf50b9e9ac5dcd42ce5943f0aa78f2b6a6b21` is under-review; BASE `628239938f3f1cb262406e80b9377b205ae02ef8`. 445 selected committed TypeScript files, AST batches of at most 160.
- 4 colliding symbol IDs namespaced by source; 6 unresolved inferred edges omitted.
- 1043 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 445 files · ~233,699 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1455 nodes · 2713 edges · 25 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 360 edges (avg confidence: 0.8)
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
2. `held()` - 16 edges
3. `tx()` - 16 edges
4. `signingOperation()` - 14 edges
5. `getOverviewViewModel()` - 13 edges
6. `observeGmailUsage()` - 11 edges
7. `writeAgreementContent()` - 11 edges
8. `requireCampaignFounder()` - 9 edges
9. `mutate()` - 9 edges
10. `lockedPreparation()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `captureSourceLead()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/source-service.ts → components/growth/crm/lead-capture-form.test.tsx
- `currentVisibilityExpiry()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/account-repository.ts → components/growth/crm/facebook-source-values.test.ts
- `buildCampaignReport()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/report.ts → components/growth/crm/facebook-source-values.test.ts
- `assessResendAccountReadiness()` --calls--> `values()`  [INFERRED]
  lib/growth/campaigns/resend-account-readiness.ts → components/growth/crm/facebook-source-values.test.ts
- `loadConfiguredAccount()` --calls--> `validTransitionUsageProvenance()`  [INFERRED]
  lib/growth/campaigns/account-repository.ts → lib/growth/campaigns/account-usage.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (96): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+88 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (65): validTransitionUsageProvenance(), createGmailClient(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential() (+57 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (42): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (61): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), retainBranch(), assertNoPendingExecution(), insertRevision(), listAgreementRegister() (+53 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (41): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (31): GET(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations(), prepareLegacyMessage(), parseGmailReferences(), assessGmailRouting() (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (31): researchDailyProspects(), PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), parseRedactedResearchReport(), ResearchAgentOutputError (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (34): insertCandidateDetails(), buildDailyResearchRunId(), publish(), readPrivate(), runDailyResearch(), ResearchIngestionError, readJsonRequestBody(), businessWebsiteHost() (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (17): formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel(), formatMoney() (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (21): appendCrmActivity(), requireCrmProspect(), createPreviewChangeRequest(), PreviewPilotRequestError, tx(), validateInput(), async(), CrmError (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (31): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+23 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (11): submit(), publishCrmChange(), push(), refresh(), activeFilterChips(), Component(), FakeEventSource, useGrowthEvents() (+3 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (25): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (19): InvalidStoredFirstEmailDraftError, parseStoredFirstEmailDraft(), sameFirstEmailCandidate(), FirstEmailTemplateRefreshError, refreshFirstEmailTemplate(), getUrlHostname(), isGoogleMapsReferenceUrl(), isHttpUrl() (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.1
Nodes (26): extractResendDeliveryCandidate(), extract(), encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign() (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (16): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (12): exerciseLegacyConfirmation(), approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit() (+4 more)

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
