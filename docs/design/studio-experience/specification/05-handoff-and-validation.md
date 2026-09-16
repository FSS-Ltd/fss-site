# Implementation handoff and verification

## Deliverables

The complete local atlas contains **88 references**: 31 client screens, 37 founder screens, 10 shared states, 2 notification emails and 8 mobile layouts. Each has an editable SVG, a PNG preview and an explicit behavioural contract. The local browser supports search, collection filters and direct screen links. Forms in the drawings are illustrations, not functional application controls.

Start with the product specification, then the workflow contracts, then the screen contracts and design system. Implement a complete vertical slice at a time. A visually accurate screen with a no-op primary action fails acceptance.

## Figma status

[FSS Studio Experience](https://www.figma.com/design/mfccE8T0vYDxTIpQUGBkFV) contains native foundations, component work and five initial screens: C00 sign-in, C01 home, C02 getting started, C05 Kanban and C09 review. The foundations include colour/spacing/radius variables, text styles, button and field variants, and client/founder navigation components.

The connected Starter plan then returned an MCP tool-call-limit error. Browser access was signed out. No plan upgrade was purchased. The remaining 83 references are supplied in the complete local pack; they have **not** been uploaded as native Figma frames. Later refinements such as stronger field boundaries and the sign-in layout are reflected in the local pack; they still need synchronising to the initial Figma screens.

To continue with connector capacity: reuse the existing file and component library, update the five initial screens to the final local references, then create the remaining frames with auto-layout and component instances. Do not create a second competing file. Group the single screen-atlas page into client, founder, shared, email and mobile sections, respecting the current plan's page limit.

For a manual handoff, import selected SVGs into that Figma file. SVG elements remain editable vectors/text where supported, but importing does not recreate auto-layout, variables or component instances. Use the native foundations to rebuild reusable structure. Install the appropriately licensed Geist font for matching typography; PNG previews show the intended rendering. The deliverable archive does not redistribute fonts.

## Suggested implementation order

1. **Shared shell and genuine controls:** persistent navigation, organisation context, reusable buttons/fields/statuses, responsive layout and states. Wire C01/C03/C04 to existing reads.
2. **Requests end to end:** C05–C11, F05–F08/F36, transition sheets, secure attachments, exact-version review and durable in-app/email events. Verify no-op creation and zero-project recovery on the deployed environment.
3. **Agreement creation:** F10–F17/F32/F34/F37 and C14–C16/C30. Replace raw IDs and manual hashes with named relationships and generated evidence while preserving the existing provenance/signature model.
4. **Welcome activation:** F18–F26/F33/F35, C02/C26–C29. Connect real template/task editors, preflight, activation, monitoring and recovery to the existing durable scheduler.
5. **Complete the workspace:** documents, invoices, enquiries, notifications, help, settings and access; then mobile and accessibility verification across all journeys.

Detailed milestones, API boundaries and testing are in the product specification. Preserve the current repository architecture and auth/domain services. Proposed route names must be reconciled with current route files before implementation.

## Codex execution brief

Implement the FSS Studio Experience described in this pack, using the current repository as the source of domain truth. Read the workflow contracts before modifying transitions, signing, scope, billing, access or scheduling. Use the screen IDs as acceptance references; do not invent missing workflow behaviour. Where an existing domain rule conflicts with the proposed UX, preserve the secure rule and make the UI explain the dependency. Build the five slices above with appropriate tests and browser verification. Do not treat an image of a success state as permission to bypass the real server acknowledgement. Keep a screen coverage checklist and reject dead buttons, raw UUID choices, manual source hashes, false sent/delivered states and decorative-only onboarding steps.

## Validation scope

**Checks completed:** 88 unique screen IDs with matching acceptance contracts; all SVGs parse; reference links resolve; measured text overflow is zero; relative document links resolve; production-tool Python syntax and gallery JavaScript syntax pass. Figma script fragments parse in their intended async connector context. All screen layouts were reviewed in contact sheets, with selected key screens inspected at larger size. Browser verification confirmed gallery loading, screen search, detail opening and the eight-screen mobile collection.

The accompanying validation report records every screen's size and text bounds. Additional pack checks verify unique IDs, valid SVG XML, matching screen/rule coverage and reference targets. Selected desktop, mobile and email previews are inspected visually; the gallery is checked in a browser. This is design-artifact validation, not application accessibility certification or an end-to-end test of the deployed portal.

The checkout was inspected at local commit `65a49852`. Remote HEAD freshness and the live user's precise New request failure were not established. The code contains a real request form; observed code gaps include its zero-project dead end, static board layout, raw agreement relationship IDs and manual evidence fields. Do not present a suspected cause as a reproduced production bug.

No application source, migrations, dependencies or production configuration were changed. Application type checking, linting, unit/integration tests and builds were therefore not run for this specification task. During implementation run the repository's existing `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration:operations` and `pnpm build`, plus focused browser tests for each modified flow. Required services/environment must be configured for integration and build checks; do not claim a passing deployment from artifact validation alone.
