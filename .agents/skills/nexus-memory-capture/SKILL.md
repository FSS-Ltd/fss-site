# Skill: nexus-memory-capture

**Trigger:** `/nexus-memory-capture`

**Purpose:** Save durable context from the current session to the Nexus vault memory system. Prompts for the right type and destination, then writes the memory file.

## Steps

When invoked, do the following:

1. **Ask:** "What do you want to remember from this session?"
   - Prompt the user for a one-sentence summary.

2. **Classify:** Ask the user to pick the memory type:
   - `user` — something about Jean-Fidele's preferences or working style
   - `feedback` — a correction or confirmed approach (include Why + How to apply)
   - `project` — an ongoing work fact (who, what, why, by when — use absolute dates)
   - `reference` — a pointer to an external system
   - `operational` — a vault or ecosystem operating rule

3. **Scope:** Ask where this should live:
   - `all-assistants` → `The Nexus/14 AI Collaboration/Shared Context/`
   - `claude` → `The Nexus/14 AI Collaboration/Claude Memory/`
   - `project:fss-site` → `The Nexus/14 AI Collaboration/Context Packs/fss-site/`

4. **Privacy gate:**
   - Confirm no secrets, credentials, tokens, or PII are in the memory note.
   - If in doubt, link to a source note instead of inlining content.

5. **Write** the memory file using the format from `Memory Capture Template.md`:
   - Filename: `YYYY-MM-DD <short-slug>.md`
   - Location: determined in step 3.

6. **Confirm** the file was written and show the path.

## Notes

- Never write a memory note that contains a secret, token, password, API key, or unreviewed PII.
- Never duplicate content already in `Shared Context.md` or `AI Vault Operating Rules.md`.
- See `The Nexus/14 AI Collaboration/Shared Context/Memory Capture Template.md` for the full template format.
