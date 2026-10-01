# Welcome experience and operations rollout

Status: implemented locally; production rollout requires approval.

## Delivery

The welcome template area is a library of three service editions. Open an edition, load its designed content if the retained draft is legacy, review it, save the draft and publish. This deliberate conversion preserves edited drafts and immutable published versions. New client journeys use the chosen published content and checklist together, with personalised facts and retained editing state. Existing approvals use their legacy renderer and retained bytes.

Studio access now uses aggregate cards, identity views and scoped dialogs. Staff actions require active staff membership plus a verified identity matching the configured founder (`GROWTH_OS_OWNER_EMAIL`). Ordinary administrators retain organisation-scoped client management.

Settings apply to separate revisioned active records, with an audit entry for each section. Historical settings drafts stay inactive. Identity feeds the Studio shell and new welcome materials; the approved reply-to feeds new welcome emails; timezone feeds Studio date presentation and new client defaults; response expectation feeds new packet communication and client guidance; capacity feeds Studio operational status. Scheduling remains 09:00 Europe/London. Approved snapshots and contractual terms remain frozen.

## Deployment sequence

1. Review and apply the additive migrations in timestamp order: `20261001150000_operations_active_studio_settings.sql`, `20261001151000_operations_welcome_draft_restoration.sql`, and `20261001153000_operations_client_welcome_packets.sql`. Run the repository migration checks against the deployment's complete migration history.
2. Configure `OPERATIONS_STUDIO_APPROVED_REPLY_TO_ADDRESSES` with a comma-separated approved list. This is an allowlist of public email addresses; credentials and provider enablement remain under existing deployment controls.
3. Apply Identity and Communication settings explicitly. A new designed welcome requires an approved reply-to and current active values. Existing drafts remain drafts.
4. Save and publish each reviewed designed packet through the template workspace, then exercise a synthetic journey without external sends.
5. Confirm tenant isolation, founder staff administration, invitation provider outcomes, settings conflicts, PDF overflow errors, client reading/download and legacy approvals before enabling delivery.

## Rollback

Roll back the application release while retaining additive tables and functions. Legacy welcome rendering and existing approval bytes remain available. Reapply prior ordinary settings values through the revisioned API to create an auditable settings rollback. Do not rewrite approvals, delete active journeys or revert published packet versions in place.

## Verification evidence

Local verification uses synthetic fixtures and an isolated PostgreSQL cluster. No production migration, deployment, invitation or email send is part of this implementation. Final check results and any environment limitations are recorded in the implementation handoff.

## Release checks requiring separate follow-up

- Next.js and its ESLint configuration are patched from 16.3.3 to 16.3.8. This includes the [16.3.6 critical fix](https://github.com/vercel/next.js/releases/tag/v16.3.6) and the [16.3.8 security fixes](https://github.com/vercel/next.js/releases/tag/v16.3.8). The production dependency audit now reports no known vulnerabilities. The current checkout has its own dependency directory; the previously shared worktree directory was preserved.
- Repository screen coverage reports two unrelated commercial-offer routes without coverage rows: `/portal/agreements/offers/:parameter` and `/portal/admin/clients/:parameter/commercial-offers/:parameter`. Welcome, access and settings screen rows were updated and their browser regressions pass.
- The legacy historical settings draft writer retains its existing database grant mismatch. It is independent of the new active settings writer, which passes real database integration tests. Historical drafts remain readable and inactive.
