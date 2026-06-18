# Skill: nexus-handoff

**Trigger:** `/nexus-handoff`

**Purpose:** Produce a structured handoff note at the end of a session so the next agent (or next session) can pick up without asking for context.

## Steps

When invoked:

1. **Gather session state:**
   - Run: `git status --short` and `git log --oneline -5`
   - Report what was done, what is uncommitted, and what branch is active.

2. **Ask the user:**
   - What was completed?
   - What was not completed and why?
   - What should the next session focus on?
   - Are there any open questions needing a human answer?

3. **Run privacy gate:**
   - Confirm the handoff note will not contain secrets, PII, or unreviewed sensitive content.
   - Link to source notes instead of inlining sensitive content.

4. **Write** the handoff note using `Agent Handoffs/Handoff Template.md`:
   - Filename: `YYYY-MM-DD fss-site Handoff.md`
   - Location: `The Nexus/14 AI Collaboration/Agent Handoffs/`

5. **Include** a "Next Session Start Prompt" section — the exact prompt the next agent should paste in to pick up cleanly.

6. **Confirm** the file path and ask if a session log should also be written (`/nexus-memory-capture`).

## Notes

- The handoff note should be self-contained. The next agent should not need this conversation's context to continue.
- Always include the active branch name and any uncommitted state.
- Cross-reference the context pack: `The Nexus/14 AI Collaboration/Context Packs/fss-site/Context Pack.md`
