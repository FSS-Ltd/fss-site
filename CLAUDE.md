# Claude Code — fss-site

## Load Order

At the start of every session, load in this order:

1. This file (CLAUDE.md)
2. `AGENTS.md` in this repo (FSS Agent Operating System v2 + Nexus context)
3. `.claude/rules/nexus-shared-context.md` (vault context summary)
4. `.claude/rules/project-rules.md` (project-specific rules and branch)

Or use the `/nexus-session-start` skill to automate this.

## Session Start Gate

1. Run `git branch --show-current` — if on `main` or `master`, stop. Create a named branch.
2. Confirm a design doc exists before writing any production code.
3. Read the last 5 commits: `git log --oneline -5`
4. Confirm the session goal before making changes.


## Branch Naming

Never prefix branches with `claude/` or any agent identifier.

Standard prefixes: `feat/` `fix/` `chore/` `refactor/` `perf/` `test/` `docs/`

## Claude-Only Notes

- Use `/nexus-session-start` at the beginning of every session.
- Use `/nexus-memory-capture` to save durable context to the vault after a session.
- Use `/nexus-handoff` to produce a handoff note before ending a session.

## Project Maps and Content Rules

- Feature inventory: `FEATURE_TREE.md` (public-site features are under "Public site subfeatures"). Graph: `graphify-out/`.
- Anyone writing a blog post, service page or resource must read `docs/seo/keyword-bank.md` first, pick one open primary phrase from it, and mark it used.
- Positioning and page set: `docs/superpowers/specs/2026-11-11-ai-led-seo-lead-growth-design.md`.

## Vault Path

`/Users/JeanFidele/The Nexus Ecosystem/The Nexus/14 AI Collaboration/Context Packs/fss-site/Context Pack.md`
