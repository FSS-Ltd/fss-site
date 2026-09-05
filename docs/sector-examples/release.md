# Sector examples release

Production deployment and eligible first-email refresh explicitly approved by
the user after updating the scheduled agent launcher, 2026-09-05.

The release is based on production commit `0b94db99`. It adds the 40 examples,
120 service pages, shared sector classifier, launcher-generated link directory,
draft ingestion and safe refresh. Existing live concepts, newer preview approval
logic, property controller, redirects and configuration are retained.

The installed LaunchAgent runs the original project checkout. Its next run will
read the updated launcher and catalog without restarting or triggering research.
Both the launcher and draft ingestion use the shared catalog; ingestion chooses
four links from the verified sector and business name. Existing private concept
links and started outreach are protected.

Release checkout verification: 1,466 unit tests passed, scoped ESLint passed,
TypeScript and production webpack build passed (257 static routes overall).
Dependency lockfile unchanged. CI and production verification follow publication.
The earlier implementation/verification notes describe the original checkout;
this record tracks the production-based release.

After public route verification, re-read eligible drafts through the direct
Supabase connector, validate them with the released renderer, and apply only
unchanged, still-eligible rows with audit events. No email is sent.
