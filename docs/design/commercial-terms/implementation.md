# Client currencies and commercial offers

Owner: Technical Agent. Status: implemented on a scoped PR branch, release approval pending. Updated: 2026-10-01.

## Behaviour

Staff select GBP, USD or EUR per client. Existing clients default to GBP. New working drafts capture the client preference at first save; the database preserves that currency on later saves. Existing offers, revisions and financial records retain their original currency.

One-off fees are staff-priced. Ongoing compensation can be fixed recurring cash, a client-proposed combined recurring amount, revenue share, or both alternatives. Client proposals require at least 20 native currency units per period or 10% revenue share. Fixed staff terms have no proposal floor. Proposed cash services must share cadence and contractual dates.

Publication freezes offer terms and retains exact fixed-choice PDFs with staff approval evidence. A fixed selection atomically creates its agreement and signing approval. Custom proposals require staff review before their exact signing document is retained. Rejections retain a reason and allow resubmission. Staff allocate the accepted total, including recorded tax and discounts, exactly across recurring lines. Selection/review commands reject stale versions and check current permissions.

Revenue share retains setup installments and service activation dates, while replacing recurring cash charges. It records the revenue source, calculation basis, duration, reporting requirements and payment terms. Equity ownership, FX conversion, automated revenue reporting and share collection are outside this release.

## Data and security

Four additive Operations migrations implement client currency updates, currency-aware billing, immutable commercial offers/event history, and builder publication. Existing `*Pence` column names remain compatible; shared money helpers use integer minor units. Currency updates and offer lifecycle changes are audited transactionally. Published offers and retained branches cannot be rewritten by application roles. Event history has scoped reads and no application write grants.

Billing schedules, Stripe customers, invoices, reconciliation, amendments, refunds/disputes and onboarding billing carry the signed currency. Customer mappings are scoped by organisation/account/environment/currency. Bacs remains GBP-only. Database guards reject mismatched currencies and recurring revenue-share cash obligations. Reports filter or group currencies and never add unlike monetary units. Currency does not infer tax or enable automatic tax.

## Verification

- All 64 PR migrations replayed from a fresh disposable local PostgreSQL database; migration policy passed.
- Isolated PR full unit suite passed (2,121 tests), including retained PDF currency/share tests.
- Isolated PR Operations integration suite passed (140 tests). Operations coverage passed (548 tests): 91.34% lines, 88.17% branches and 93.22% functions.
- Commercial lifecycle covers fixed selections, retained PDFs, approval/rejection/resubmission, exact allocations, expiry, concurrent selections, null/stale versions, revoked access, organisation boundaries, actual reviewer attribution, immutable audit history, builder finalisation bypass, currency preservation, signing, service activation and setup-only billing.
- Desktop/mobile browser checks passed for unselected alternatives, invalid/valid proposal floors, stale response feedback, setup fees, exact tax/discount allocations and responsive layout. Final screens reviewed visually.
- Type checking, production build, repository-wide lint (excluding separate local worktrees), formatting and diff whitespace checks passed.
- PR #282 CI repair: reviewed the 17 failing Linux visual artifacts from run `36929927497`. Updated only the corresponding Linux and macOS baselines for the new currency controls, compensation form and monetary formatting. The affected local comparison run passed 19 tests without snapshot updates. Screenshot tolerances and application code remain unchanged.

## Release and rollback

No dependencies added. Existing uncommitted engagement and concurrent welcome/settings work was preserved. No production migration, deployment or client communication occurred.

Use the existing Operations, Studio, signing and billing release gates. Production migration and deployment require explicit human approval. Deploy migrations before application code. Revenue share collection remains manual. Roll back the application release or disable its gates; preserve additive tables, offer history, signing artifacts and financial evidence. Never delete accepted offers, signed revisions or billing records as a rollback strategy.

## Changed file groups

- `lib/operations/money.ts` and agreement validation/builder/signing modules: shared Currency type, exact parsing, snapshots, retained share terms and PDF amounts.
- `lib/operations/organisations/staff-service.ts`, `lib/operations/studio/clients.ts`, client currency HTTP route/API and `components/portal/studio/client-{form,detail,currency-form}`: creation, reads, reviewed updates and concurrency.
- `lib/operations/agreements/commercial-{types,repository,service}.ts`, commercial HTTP/download handlers, staff/client offer routes and `components/portal/agreements/*commercial-offer*`: publication, selection, proposals, review and responsive forms.
- Agreement builder/legacy agreement components, signing review and onboarding display: currency-aware fees, retained setup/share terms, publication handoff and service readiness.
- Billing domain/customer/invoice/projection/reconciliation/amendment/portal modules, onboarding billing provider, metrics/Studio queue modules and corresponding portal/staff billing components: same-currency financial handling and grouped reporting.
- Migrations `20261001130000_operations_client_currency.sql`, `20261001131000_operations_billing_currencies.sql`, `20261001132000_operations_commercial_offers.sql`, `20261001133000_operations_builder_commercial_offers.sql`.
- Unit/integration fixtures and tests, `tests/e2e/commercial-offers.spec.ts`, `playwright.commercial.config.ts`, and isolated commercial visual scenarios.

The PR snapshot is based on the latest main branch and excludes concurrent welcome, settings and access work. The original checkout and index remain untouched.
