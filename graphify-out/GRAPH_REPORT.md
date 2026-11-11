# Graph Report - agreement and proposal routing scope  (2026-11-11)

## Corpus Check
- 121 files · ~44,220 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 378 nodes · 471 edges · 19 communities detected
- Extraction: 71% EXTRACTED · 29% INFERRED · 0% AMBIGUOUS · INFERRED: 138 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `signingOperation()` - 15 edges
2. `writeAgreementContent()` - 11 edges
3. `hasCompleteSigningEvidence()` - 9 edges
4. `writeServiceLines()` - 9 edges
5. `contentFromForm()` - 8 edges
6. `configuration()` - 8 edges
7. `signingEnabled()` - 8 edges
8. `textValue()` - 7 edges
9. `executeStaffSigningCommand()` - 7 edges
10. `ensureSigningSpace()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `agreementWorkspaceHref()` --calls--> `portalPath()`  [INFERRED]
  components/portal/agreements/staff-agreement-overview.tsx → lib/operations/auth/portal-url.ts
- `signingWorkspaceHref()` --calls--> `portalPath()`  [INFERRED]
  components/portal/agreements/staff-agreement-overview.tsx → lib/operations/auth/portal-url.ts
- `signingOperation()` --calls--> `run()`  [INFERRED]
  lib/operations/agreements/signing-service.ts → components/portal/agreements/signing-deadline-actions.tsx
- `agreementHref()` --calls--> `portalPath()`  [INFERRED]
  components/portal/agreements/client-agreement-list.tsx → lib/operations/auth/portal-url.ts
- `signingPounds()` --calls--> `formatMoney()`  [INFERRED]
  lib/operations/agreements/signing-pdf-content.ts → components/portal/agreements/commercial-offer-summary.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (27): retainBranch(), assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement(), loadAgreements(), readAgreementRegister(), withAgreementTransaction() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (26): commercialOfferRouteConfiguration(), createCommercialOfferRouteHandler(), portalCommercialOfferRoute(), staffCommercialOfferRoute(), portalAuthConfigured(), readPortalAuthConfig(), resolvePortalOrigin(), deployedEnvironment() (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (14): formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel(), clientSigningProgress() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (15): contentFromForm(), beginEngagement(), save(), save(), formatGbp(), mergeContent(), numberValue(), textValue() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (18): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), executeFounderSigningCommand(), executePortalSigningCommand(), executeStaffSigningCommand(), approveAgreementSigning() (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (14): signingPounds(), writeAgreementContent(), writeExecutionRecord(), writeRevenueShare(), writeServiceLines(), ensureSigningSpace(), masthead(), signingDetail() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (12): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml(), agreementPath(), agreementHref(), agreementPath(), createInvitationActivationUrl() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (6): save(), prefillFromEngagement(), replaceEngagement(), beginEngagement(), persist(), selectEngagement()

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (9): AgreementBuilderDraftConflict, draftConflict(), finaliseDraft(), loadStaffAgreementBuilderDraft(), saveStaffAgreementBuilderDraft(), toAgreementDraft(), AgreementBuilderDraftValidationError, builderValidationIssues() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (7): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments()

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (5): completeDraft(), savedDraft(), content(), recurringDraft(), agreementDraft()

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (4): handler(), request(), errorMessage(), run()

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (2): getPortalCommercialOffer(), ClientOfferPage()

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (2): useAgreementBuilderGroups(), AgreementBuilderPeopleStep()

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (2): createAgreementRouteHandler(), setup()

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (1): EngagementCommandConflict

### Community 17 - "Community 17"
Cohesion: 0.83
Nodes (3): projectCompletion(), runSigningGrowthWorker(), signingGrowthValues()

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (2): resultFrom(), submit()

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (1): AgreementConflict

## Knowledge Gaps
- **1 isolated node(s):** `PayloadTooLargeError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (8 nodes): `page.tsx`, `getPortalCommercialOffer()`, `getStaffCommercialOffer()`, `listPortalCommercialOffers()`, `listStaffCommercialOffers()`, `loadCommercialOffers()`, `commercial-repository.ts`, `ClientOfferPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (7 nodes): `focusInvalidControl()`, `headingId()`, `invalidControl()`, `useAgreementBuilderGroups()`, `AgreementBuilderPeopleStep()`, `agreement-builder-groups.tsx`, `agreement-builder-people-step.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (5 nodes): `route-handler.test.ts`, `route-handler.ts`, `createAgreementRouteHandler()`, `request()`, `setup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (4 nodes): `completeStaffEngagementCommand()`, `EngagementCommandConflict`, `.constructor()`, `engagement-service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (3 nodes): `engagement-form.tsx`, `resultFrom()`, `submit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `types.ts`, `AgreementConflict`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prepareSigningInTransaction()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.211) - this node is a cross-community bridge._
- **Why does `signingOperation()` connect `Community 4` to `Community 11`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `run()` connect `Community 11` to `Community 4`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `signingOperation()` (e.g. with `run()` and `publishStaffCommercialOffer()`) actually correct?**
  _`signingOperation()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `writeAgreementContent()` (e.g. with `startSigningPdf()` and `signingTitle()`) actually correct?**
  _`writeAgreementContent()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `hasCompleteSigningEvidence()` (e.g. with `presentationFor()` and `statusLabel()`) actually correct?**
  _`hasCompleteSigningEvidence()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `writeServiceLines()` (e.g. with `ensureSigningSpace()` and `signingSection()`) actually correct?**
  _`writeServiceLines()` has 6 INFERRED edges - model-reasoned connections that need verification._