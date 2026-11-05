# Graph Report - components/portal/agreements, lib/operations/agreements  (2026-11-05)

## Corpus Check
- 109 files · ~41,373 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 343 nodes · 411 edges · 18 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Agreement Draft Builder|Agreement Draft Builder]]
- [[_COMMUNITY_Agreement Signing|Agreement Signing]]
- [[_COMMUNITY_Agreement Draft Builder|Agreement Draft Builder]]
- [[_COMMUNITY_Commercial Agreement Terms|Commercial Agreement Terms]]
- [[_COMMUNITY_Agreement Signing|Agreement Signing]]
- [[_COMMUNITY_Agreement Signing|Agreement Signing]]
- [[_COMMUNITY_Agreement Draft Builder|Agreement Draft Builder]]
- [[_COMMUNITY_Agreement Draft Builder|Agreement Draft Builder]]
- [[_COMMUNITY_Agreement Draft Builder|Agreement Draft Builder]]
- [[_COMMUNITY_Commercial Agreement Terms|Commercial Agreement Terms]]
- [[_COMMUNITY_Agreement Signing|Agreement Signing]]
- [[_COMMUNITY_Agreement Draft Builder|Agreement Draft Builder]]
- [[_COMMUNITY_Agreement Records|Agreement Records]]
- [[_COMMUNITY_Agreement Records|Agreement Records]]
- [[_COMMUNITY_Reviewed Engagements|Reviewed Engagements]]
- [[_COMMUNITY_Agreement Signing|Agreement Signing]]
- [[_COMMUNITY_Reviewed Engagements|Reviewed Engagements]]
- [[_COMMUNITY_Agreement Records|Agreement Records]]

## God Nodes (most connected - your core abstractions)
1. `signingOperation()` - 15 edges
2. `writeAgreementContent()` - 11 edges
3. `hasCompleteSigningEvidence()` - 9 edges
4. `writeServiceLines()` - 9 edges
5. `contentFromForm()` - 8 edges
6. `configuration()` - 8 edges
7. `executeStaffSigningCommand()` - 7 edges
8. `ensureSigningSpace()` - 7 edges
9. `signingDetail()` - 7 edges
10. `prepareSigningInTransaction()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `signingOperation()` --calls--> `run()`  [INFERRED]
  lib/operations/agreements/signing-service.ts → components/portal/agreements/signing-deadline-actions.tsx
- `signingPounds()` --calls--> `formatMoney()`  [INFERRED]
  lib/operations/agreements/signing-pdf-content.ts → components/portal/agreements/commercial-offer-summary.tsx
- `masthead()` --calls--> `save()`  [INFERRED]
  lib/operations/agreements/signing-pdf-layout.ts → components/portal/agreements/agreement-builder-fees-step.tsx
- `ClientAgreementDetail()` --calls--> `stagePresentation()`  [INFERRED]
  components/portal/agreements/client-agreement-detail.tsx → lib/operations/agreements/stage.ts
- `presentationFor()` --calls--> `allRequiredSignaturesRecorded()`  [INFERRED]
  components/portal/agreements/staff-signing-status.tsx → lib/operations/agreements/signing-state.ts

## Communities

### Community 0 - "Agreement Draft Builder"
Cohesion: 0.1
Nodes (18): emptyLine(), ensureClientProposedRecurringService(), isUntouchedStarterLine(), linesForAgreementDraft(), monthlyRecurringLine(), parseFeeLines(), parseInstallments(), contentFromForm() (+10 more)

### Community 1 - "Agreement Signing"
Cohesion: 0.11
Nodes (19): assertNoPendingExecution(), insertRevision(), listAgreementRegister(), loadAgreement(), loadAgreements(), readAgreementRegister(), withAgreementTransaction(), assertEditable() (+11 more)

### Community 2 - "Agreement Draft Builder"
Cohesion: 0.11
Nodes (14): formatGbp(), ClientAgreementDetail(), CompletionNotice(), oneOffTotal(), SigningRecord(), AgreementRow(), statusLabel(), clientSigningProgress() (+6 more)

### Community 3 - "Commercial Agreement Terms"
Cohesion: 0.19
Nodes (18): resendStaffAgreementNotification(), executePortalCommercialOfferCommand(), executeStaffCommercialOfferCommand(), publishStaffCommercialOffer(), executeFounderSigningCommand(), executePortalSigningCommand(), executeStaffSigningCommand(), approveAgreementSigning() (+10 more)

### Community 4 - "Agreement Signing"
Cohesion: 0.28
Nodes (14): signingPounds(), writeAgreementContent(), writeExecutionRecord(), writeRevenueShare(), writeServiceLines(), ensureSigningSpace(), masthead(), signingDetail() (+6 more)

### Community 5 - "Agreement Signing"
Cohesion: 0.2
Nodes (14): createSigningCommandHandler(), createSigningDownloadHandler(), configuration(), founderSigningDownloadRoute(), founderSigningRoute(), portalSigningDownloadRoute(), portalSigningRoute(), staffSigningDownloadRoute() (+6 more)

### Community 6 - "Agreement Draft Builder"
Cohesion: 0.15
Nodes (6): save(), prefillFromEngagement(), replaceEngagement(), beginEngagement(), persist(), selectEngagement()

### Community 7 - "Agreement Draft Builder"
Cohesion: 0.18
Nodes (9): AgreementBuilderDraftConflict, draftConflict(), finaliseDraft(), loadStaffAgreementBuilderDraft(), saveStaffAgreementBuilderDraft(), toAgreementDraft(), AgreementBuilderDraftValidationError, builderValidationIssues() (+1 more)

### Community 8 - "Agreement Draft Builder"
Cohesion: 0.2
Nodes (5): completeDraft(), savedDraft(), content(), recurringDraft(), agreementDraft()

### Community 9 - "Commercial Agreement Terms"
Cohesion: 0.27
Nodes (8): retainBranch(), finishSigningPdf(), agreementContent(), pdf(), renderAgreementSource(), renderSignedAgreement(), signingHash(), supportsSigningText()

### Community 10 - "Agreement Signing"
Cohesion: 0.25
Nodes (3): errorMessage(), run(), request()

### Community 11 - "Agreement Draft Builder"
Cohesion: 0.29
Nodes (2): useAgreementBuilderGroups(), AgreementBuilderPeopleStep()

### Community 14 - "Agreement Records"
Cohesion: 0.4
Nodes (2): createAgreementRouteHandler(), setup()

### Community 15 - "Agreement Records"
Cohesion: 0.7
Nodes (4): agreementNotificationEmail(), agreementNotificationIdempotencyKey(), dispatchAgreementNotifications(), escapeHtml()

### Community 16 - "Reviewed Engagements"
Cohesion: 0.5
Nodes (1): EngagementCommandConflict

### Community 17 - "Agreement Signing"
Cohesion: 0.83
Nodes (3): projectCompletion(), runSigningGrowthWorker(), signingGrowthValues()

### Community 22 - "Reviewed Engagements"
Cohesion: 1.0
Nodes (2): resultFrom(), submit()

### Community 28 - "Agreement Records"
Cohesion: 0.67
Nodes (1): AgreementConflict

## Knowledge Gaps
- **Thin community `Agreement Draft Builder`** (7 nodes): `focusInvalidControl()`, `headingId()`, `invalidControl()`, `useAgreementBuilderGroups()`, `AgreementBuilderPeopleStep()`, `agreement-builder-groups.tsx`, `agreement-builder-people-step.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agreement Records`** (5 nodes): `route-handler.test.ts`, `route-handler.ts`, `createAgreementRouteHandler()`, `request()`, `setup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reviewed Engagements`** (4 nodes): `completeStaffEngagementCommand()`, `EngagementCommandConflict`, `.constructor()`, `engagement-service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reviewed Engagements`** (3 nodes): `engagement-form.tsx`, `resultFrom()`, `submit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agreement Records`** (3 nodes): `types.ts`, `AgreementConflict`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
## Coverage and freshness

Rebuilt the entire affected agreement scope after the navigation change. Source references are repository-relative. Generated files, dependencies, credentials, runtime data, and private resources were excluded by selecting only these two source directories. Documentation, styles, routes, and other domains are outside extraction coverage. The feature tree indexes those domains without claiming exhaustive mapping.

The installed deterministic extractor provides limited TSX component symbol extraction. Component consumers and navigation behavior were verified directly in source and in the Codex browser; no semantic component edges were invented. All graph relationships are extracted AST facts. Model token cost: zero for structural extraction; no semantic model calls.
