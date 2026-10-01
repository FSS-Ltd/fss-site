# FSS welcome and operations implementation plan

**Goal:** Implement the approved welcome publication and operations workspaces.
**Spec:** `docs/design/fss-welcome-experience.md` (user approved in chat).
**Architecture:** Typed versioned content feeds deterministic PDF/HTML/email renderers. Access and settings remain server-authorised domain services. Focused workspaces consume those contracts.
**Tech stack:** Existing Next.js/React/TypeScript/Zod, PDFKit, Sharp, React Email, CSS modules.

## Global constraints

- Preserve uncommitted unrelated work and existing approval snapshots.
- No new dependencies, production side effects, or credentials in UI.
- Ten A4 pages for modern packets; legacy packs stay supported; PDFs under 2 MB.
- Welcome schedule remains 09:00 Europe/London.
- Strict types, current component tokens, accessible keyboard/touch controls, reduced motion.

## Interfaces and execution

- [ ] Task 1: Packet domain and rendering. Introduce `packet-editions.ts`, typed approved asset/section metadata, modern content version 2, new ten-page renderer, modern welcome/proposal/access/thank-you emails with legacy fallbacks. Tests cover every edition, escaping, byte limits, immutable compatibility, and overflow. Root owns all portal/onboarding UI and final client download integration.
- [ ] Task 2: Access dashboard. Own Studio access domain/route/workspace and dedicated components/styles/tests. Reuse founder services, add verified founder capability, full-dataset metrics, scoped dialogs, filters and role explanations. Tests cover permissions, aggregates and mutations. No changes to onboarding/settings files.
- [ ] Task 3: Active settings and operations station. Own Studio settings domain/route/UI, active settings migration and safe read model. Export `loadActiveStudioSettings(db, admin)` and `readActiveStudioSettings(tx)` returning revision, displayName, replyTo, timezone, responseExpectationHours, deliveryCapacity. Defaults match current behaviour. Root wires welcome/client consumers. Tests cover revisioned atomic apply, allowlist and validation, UI states. No changes to onboarding or access files.
- [ ] Task 4: Root welcome library/builder/preview UI and integration. Consume packet edition/content API and settings API; restore drafts and apply checklist/content together; accessible split preview workspace. Add client packet read/download using tenant-scoped functions and onboarding.read capability. Wire settings consumers without altering scheduler.
- [ ] Task 5: Verify and review. Run targeted tests per task, complete relevant full checks, render artifacts and inspect desktop/mobile/email/PDF outputs; independent code review; docs and isolated commits with only this task's work.

## Review focus

- Old approvals must validate against old renderers without regenerating approved bytes.
- Missing contact/agreement facts must never disappear silently during interpolation.
- Read models and downloads must not cross organisation or founder boundaries.
- Dirty values must survive stage changes, failed requests, and stale revisions.
- Dashboard totals must not be calculated from the visible page.
