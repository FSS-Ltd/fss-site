# Scoped Graph Rebuild (2026-11-23)

- TARGET `fa952bfd658571ad72240f8efcb8d02ea5d1f160` is under-review; BASE `438e0e96d98e41ecd7f3549a626da3850279b696`. 542 selected committed TypeScript files, AST batches of at most 160.
- 5 colliding symbol IDs namespaced by source; 4 unresolved inferred edges omitted.
- 1344 selected-to-selected static import/export declarations resolved with TypeScript; source lines are extracted facts, not semantic proof. Zero model tokens and external uploads.
- Coverage is partial: docs, SQL, styles, dynamic imports, most routes and unselected files remain outside scope; TSX symbol extraction is limited. See source-hashes.json for exact coverage. graph.html and benchmark.json are historical, unchanged by this no-viz run.

# Graph Report - .  (2026-11-23)

## Corpus Check
- 542 files · ~292,046 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1702 nodes · 3234 edges · 30 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 403 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]

## God Nodes (most connected - your core abstractions)
1. `held()` - 21 edges
2. `GoogleGmailClient` - 17 edges
3. `signingOperation()` - 14 edges
4. `getOverviewViewModel()` - 13 edges
5. `observeGmailUsage()` - 11 edges
6. `writeAgreementContent()` - 11 edges
7. `tx()` - 10 edges
8. `text()` - 10 edges
9. `writeServiceLines()` - 10 edges
10. `refresh()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `handler()`  [INFERRED]
  app/api/cron/gmail-sync/route.ts → lib/growth/campaigns/command-route-handler.test.ts
- `gmail()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/account-command-route-handler.test.ts → components/growth/crm/lead-capture-form.test.tsx
- `resend()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/account-command-route-handler.test.ts → components/growth/crm/lead-capture-form.test.tsx
- `execute()` --calls--> `push()`  [INFERRED]
  lib/growth/campaigns/command-route-handler.test.ts → components/growth/crm/lead-capture-form.test.tsx
- `run()` --calls--> `request()`  [INFERRED]
  components/portal/agreements/signing-deadline-actions.tsx → lib/growth/campaigns/command-route-handler.test.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (88): createAccountCommandHandler(), handler(), executeAccountControlCommand(), currentVisibilityExpiry(), loadConfiguredAccount(), loadConfiguredAccountReadiness(), loadReservationAccount(), POST() (+80 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (55): validTransitionUsageProvenance(), GET(), createGmailClient(), createLiveOutreachDispatcher(), createOutreachDispatcher(), claimDueMessage(), claimPendingConfirmations(), prepareLegacyMessage() (+47 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (77): resendStaffAgreementNotification(), agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute() (+69 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (50): buildDailyResearchRunId(), publish(), readPrivate(), researchDailyProspects(), runDailyResearch(), createEditDraftHandler(), createFounderFirstEmailRevision(), InvalidFirstEmailRevisionContentError (+42 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (41): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (37): createFirstEmailApprover(), FirstEmailApprovalError, isFallbackKey(), FirstEmailApprovalPersistenceError, resolveVisual(), createApprover(), createFakeRepository(), createFakeState() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (48): gmailEvidence(), discardBody(), gmailErrorCode(), GoogleGmailClient, providerError(), readJson(), requireCredential(), observeGmailConfirmation() (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (37): formatGrowthDateTime(), basis(), getCampaignReports(), jobState(), snapshot(), row(), validDate(), validModernWinner() (+29 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (18): formatGbp(), formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (25): PayloadTooLargeError, readRawBody(), createFacebookReadHandler(), handler(), read(), parseRedactedResearchReport(), ResearchAgentOutputError, runRedactedChildProcess() (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.04
Nodes (26): gmail(), resend(), submit(), POST(), POST(), submit(), submit(), submit() (+18 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (30): classifyResendOutreachAdverse(), classify(), extractResendDeliveryCandidate(), extract(), parseGmailRecipients(), parseHeader(), splitMailboxes(), encodePayload() (+22 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (16): appendCrmActivity(), requireCrmProspect(), async(), CrmError, createFounderVerificationHandler(), handler(), captureBusiness(), captureContact() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (36): buildPipelineOverview(), buildSequenceHealth(), fetchFirstEmailsTab(), fetchFollowUpsDueToday(), fetchFollowUpsTab(), fetchLastResearchRunDate(), fetchPipelineStatusCounts(), fetchRepliesTab() (+28 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (23): exerciseDirectProofRace(), scheduledFollowUpsForFirstSend(), createGmailConfirmation(), createLiveGmailConfirmation(), exerciseConfirmationDueFairness(), exerciseLegacyConfirmation(), exerciseProoflessConfirmations(), approveSeoAuditDraft() (+15 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (23): insertCandidateDetails(), createPreviewChangeRequest(), PreviewPilotRequestError, tx(), validateInput(), assertNoPendingExecution(), insertRevision(), listAgreementRegister() (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (6): publishCrmChange(), Component(), FakeEventSource, useGrowthEvents(), item(), row()

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (15): createGlobalMessageReview(), postAction(), run(), fetchCitations(), fetchDraftRow(), fetchEmailAsset(), fetchHasEnrollment(), fetchSuppressed() (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (7): readFacebookEventUrl(), subscribeFacebookChanges(), validateFacebookEventUrl(), request(), cursor(), encode(), getCrmWorkspace()

### Community 19 - "Community 19"
Cohesion: 0.23
Nodes (15): buildFilterFragments(), decodeDealCursor(), encodeDealCursor(), fetchCommercialHistory(), fetchCoreRow(), fetchDealRows(), fetchDealTotalCount(), fetchEvidence() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.19
Nodes (5): classifyProviderError(), requireNonEmpty(), ResendClientError, ResendSdkGateway, withTimeout()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (11): request(), createSignature(), isValidDraftBackfillResponse(), isValidResponse(), triggerCurrentTenDraftPreviewBackfill(), triggerCurrentTenPreviewPullRequest(), triggerCurrentThirteenEvidenceRefresh(), triggerPreviewPullRequest() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (3): resultFrom(), submit(), EngagementCommandConflict

### Community 23 - "Community 23"
Cohesion: 0.54
Nodes (7): fetchAssessmentRow(), fetchEvidence(), fetchVisualAsset(), getVisualConcept(), getWebsiteStrategy(), parseSection(), prospectSummaryFrom()

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (2): readBoundedResendJson(), readResendUsage()

### Community 25 - "Community 25"
Cohesion: 0.38
Nodes (4): daysInMonth(), parseCalendarDate(), resolveLondonMonthRange(), resolveUtcWindow()

### Community 27 - "Community 27"
Cohesion: 0.6
Nodes (3): assessAccountReadiness(), count(), validTime()

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
- **Thin community `Community 24`** (8 nodes): `outreach-transport.test.ts`, `outreach-transport.ts`, `usage.test.ts`, `usage.ts`, `createResendOutreachTransport()`, `readBoundedResendJson()`, `readResendUsage()`, `payload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (5 nodes): `ProspectPreviewApprovalPersistenceError`, `.constructor()`, `approval-repository.ts`, `createTransaction()`, `toJsonValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (4 nodes): `listStudioClients()`, `loadStudioClient()`, `parseSearch()`, `clients.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
