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

- [ ] Add focused v2 contract and validation tests, keeping legacy contract unchanged.
- [ ] Add migration and transactional global persistence with identity deduplication and tests.
- [ ] Route v2 through intake without previews; preserve exact email snapshots and test replay/suppression.
- [ ] Add read-only draft review and nullable contact/location display with regressions.
- [ ] Run focused unit and database tests, typecheck, lint, formatting, build where available; review every changed file and commit.
