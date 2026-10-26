# Global Growth Research Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admit global businesses into internal Growth OS research review without authorizing outreach.

**Architecture:** Add a discriminated 2.0 contract beside legacy validation. Reuse transaction/audit infrastructure and existing tables, with separate global candidate persistence and research-only review rendering.

**Tech Stack:** TypeScript, Zod, PostgreSQL, Next.js, existing node:test tooling; no dependencies.

**Spec:** docs/superpowers/specs/2026-10-26-global-growth-research-design.md

## Global constraints

- Preserve legacy schemas 1.0/1.1 and all send/Gmail guards.
- V2 is internal review only; no preview generation or template replacement.
- Do not deploy, migrate production or push during implementation.

## Review focus

- Missing personal names and registration must remain honest nullable values.
- Public mailbox providers must not cause blanket rejection or cross-business domain duplicates.
- Overlapping runs and replay must not duplicate records.
- Suppressed contacts must never be admitted.
- V2 drafts must be readable but never accepted by legacy send approval.

## Tasks

- [x] Add focused v2 contract and validation tests, keeping legacy contract unchanged.
- [x] Add migration and transactional global persistence with identity deduplication and tests.
- [x] Route v2 through intake without previews; preserve exact email snapshots and test replay/suppression.
- [x] Add read-only draft review and nullable contact/location display with regressions.
- [x] Run focused unit and database tests, typecheck, lint, formatting, build where available; review every changed file and commit.

## Execution record

- Versioned intake, canonical public-source URLs, identity locks, transactional persistence and exact internal email snapshots implemented without changing legacy send parsers.
- Global records are visible in the database-backed review queue, prospect list and detail. Missing names remain null; zero estimates display as not estimated.
- Full unit suite: 2,323 passed before the final list-label additions; 67 focused tests and typecheck passed after those additions.
- Full Growth database integration suite: 40 passed. Expanded global integration also passed after independent review fixes, covering persisted review/detail/list/overview queries, Unicode domains and missing website URLs.
- Production build passed on Next 16.4.1. Full lint passed with one existing React Hook Form compiler warning. Migration policy passed for all 81 migrations.
- Independent review identified official-source fallback identity, Unicode-host normalization and country-scoped registration lookup; all corrected and covered by regression tests.
- Ruling: country plus registration is the initial identity scope. The runbook requires omitting registrations whose uniqueness is only subnational; otherwise two local registries could collide.
- Ruling: rollout is migration-first to avoid querying country_code before it exists. Root owns release, migration, live lead submission and final cleanup.
