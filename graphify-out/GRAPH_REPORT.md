# Scoped Graph Rebuild (2026-11-23)

- TARGET `c78f8a256d9cab60082dcce823d3b2b33896db02` is under-review; BASE `e1bc90f64cd09c61e73bb24a36ee6042ab7d3a95`. 416 selected committed TypeScript files, AST batches of at most 160.
- 4 colliding symbol IDs namespaced by source; 6 unresolved inferred edges omitted.
- 931 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 416 files · ~214,154 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1394 nodes · 2537 edges · 29 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 323 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 31|Community 31]]

## God Nodes (most connected - your core abstractions)
1. `GoogleGmailClient` - 17 edges
2. `createOutreachDispatcher()` - 15 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `held()` - 11 edges
6. `observeGmailUsage()` - 11 edges
7. `writeAgreementContent()` - 11 edges
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
- `insertObservation()` --calls--> `tx()`  [INFERRED]
  lib/growth/facebook/service.ts → lib/growth/prospect-previews/change-requests.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (79): executeAccountControlCommand(), assessAccountReadiness(), count(), validTime(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount() (+71 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (37): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (61): executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), retainBranch(), assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement() (+53 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (37): GET(), tx(), createGmailClient(), parseGmailReferences(), assessGmailRouting(), gmailFromAddress(), classifyGmailRoutingInTransaction(), validateGmailEffectObservation() (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (43): insertCandidateDetails(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError, requireParagraphs(), requireRetainedStandards(), requireSingleLineText(), ResearchIngestionError, InvalidStoredFirstEmailDraftError (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (51): discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential(), calculateAccessTokenExpiry(), connectGmail() (+43 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (37): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (31): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute() (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (18): formatGbp(), formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (32): buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects(), runDailyResearch(), createSignature(), isValidDraftBackfillResponse(), isValidResponse() (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (14): PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), executeFacebookCommand(), FacebookError, hash() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (26): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (11): requireCrmProspect(), async(), CrmError, captureBusiness(), captureContact(), findCapture(), captureLead(), attachCrmContact() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (24): createOutreachDispatcher(), prepareFirstEmailSend(), prepareFollowUpSend(), recordReconciledSent(), cancelMessage(), claimDueMessage(), failMessage(), getFollowUpTemplate() (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (16): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (18): fetchAuditSummary(), fetchCoreRow(), fetchEvidence(), getProspectDetail(), toProspectDetail(), buildFilterFragments(), decodeProspectCursor(), encodeProspectCursor() (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (3): Events, item(), row()

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (10): submit(), publishCrmChange(), push(), activeFilterChips(), errorMessage(), run(), Component(), FakeEventSource (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (20): encodePayload(), isSuppressed(), normaliseEmail(), recordComplaint(), recordHardBounce(), sign(), signUnsubscribeToken(), verifyUnsubscribeToken() (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (18): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (7): approveSeoAuditDraft(), claimSeoAuditCandidates(), SeoAuditApprovalError, SeoAuditDraftCompletionError, SeoAuditDraftPersistenceError, validateApprovalInput(), validateLimit()

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (4): createFirstEmailRedrafter(), FirstEmailRedraftError, FirstEmailRedraftPersistenceError, validateRequest()

### Community 24 - "Community 24"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

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
