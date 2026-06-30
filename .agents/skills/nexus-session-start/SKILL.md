# Skill: nexus-session-start

**Trigger:** `/nexus-session-start`

**Purpose:** Run the standard Nexus session-start checklist for this repo. Ensures branch, context, and design doc are confirmed before any work begins.

## Steps

When this skill is invoked, execute the following in order:

1. **Branch check**
   - Run: `git branch --show-current`
   - If on `main` or `master`: stop and ask the user to create or name a working branch before continuing.

2. **Context load confirmation**
   - Confirm CLAUDE.md, AGENTS.md, `.claude/rules/nexus-shared-context.md`, and `.claude/rules/project-rules.md` are loaded.
   - If any are missing, report which ones and ask the user to provide them.

3. **Recent commits**
   - Run: `git log --oneline -5`
   - Report what was done in the last 5 commits.

4. **Design doc check**
   - Ask: "What is the session goal, and does a design doc exist for this work?"
   - If no design doc: do not proceed with production code. Offer to create a Technical Note or design doc first.

5. **Context pack check**
   - Read: `The Nexus/14 AI Collaboration/Context Packs/fss-site/Context Pack.md`
   - Report if the pack is marked `reviewed: false` and flag it for update.

6. **Report**
   - Output a one-paragraph session brief: branch, last 5 commits summary, session goal, design doc status, context pack status.
   - Ask the user to confirm before proceeding.

## Notes

- This skill makes no file changes. It is read-only.
- If graphify-out/ is present: remind the user to run `graphify query` before modifying core modules.
