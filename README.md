# FSS Marketing Site

Next.js App Router marketing site for Faithful Software Solutions Ltd.

## Stack

- Next.js App Router
- MDX blog + resource library
- Lead capture route (`/api/lead`) with HubSpot + Resend integration
- Netlify deployment target (GitHub as source of truth)

## Local development

1. Install dependencies:

```bash
pnpm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Start dev server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Validation commands

```bash
pnpm lint
pnpm build
```

## Deployment

Netlify remains the active production host today. Deployment model and
configuration are documented in [docs/deployment.md](docs/deployment.md):

- Feature branches -> PRs into `main`
- GitHub Actions CI on PRs
- Netlify Deploy Preview on PRs
- Netlify production deploy from `main` only

A Vercel Pro release for the Growth OS is prepared but not yet live — see
the Vercel release section below. Vercel becomes the active host only
after an explicit founder-approved cutover; until then this section
stays accurate as written.

## Growth OS: Vercel release

The Growth OS is released to Vercel Pro through a verified preview,
explicit founder approval, and a reversible domain cutover, with
Netlify kept available for rollback throughout an agreed window.
Automation (Gmail sync/send, Resend dispatch, Codex research ingestion)
starts disabled at every promotion and is enabled through two separate
deliberate gates, never one flag flip. The MVP does not call a paid AI
API — that stays a separate decision after FSS reaches GBP 5,000 MRR
(`docs/growth-os/README.md`). Environment variables, provider setup,
cron schedules, release health checks, the preview checklist, the
cutover gate, rollback, and incident response are documented in
[docs/runbooks/](docs/runbooks/), prefixed `growth-os-*`.

## Growth OS: Resend marketing

The Growth OS backend sends requested-resource emails and founder-run
newsletter issues through Resend, gated on explicit consent and suppression
checks. Operating this (domain/sender setup, webhook registration, disabling
the dispatcher, suppression recovery) is documented in
[docs/runbooks/resend-marketing.md](docs/runbooks/resend-marketing.md).

## Growth OS: founder dashboard

`/growth` is the founder-only internal dashboard for running outreach:
prospect research, first-email review and approval, outreach sequences,
website-strategy review, newsletter issues, and integration
settings/automation controls. Its architecture, mockup-fidelity checklist,
accessibility review, and operating notes (Gmail connect/disconnect,
pausing automation, the cron schedule) are documented in
[docs/runbooks/founder-dashboard.md](docs/runbooks/founder-dashboard.md).

## Growth OS: pipeline and delivery

`/growth/pipeline`, `/growth/deals`, `/growth/clients`, and
`/growth/analytics` carry one prospect's commercial opportunity from
qualification through a won deal to delivery, client, and reporting views
without duplicating identity or losing audit history. Stage definitions,
when to open a new opportunity instead of reopening a closed one,
correcting a mistaken transition, pipeline-total reconciliation, the
client delivery thank-you flow, and the boundary between agreed value and
recognised accounting revenue are documented in
[docs/runbooks/pipeline-delivery.md](docs/runbooks/pipeline-delivery.md).
