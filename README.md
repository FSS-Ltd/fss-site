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

Deployment model and configuration are documented in [docs/deployment.md](docs/deployment.md):

- Feature branches -> PRs into `main`
- GitHub Actions CI on PRs
- Netlify Deploy Preview on PRs
- Netlify production deploy from `main` only

## Growth OS: Resend marketing

The Growth OS backend sends requested-resource emails and founder-run
newsletter issues through Resend, gated on explicit consent and suppression
checks. Operating this (domain/sender setup, webhook registration, disabling
the dispatcher, suppression recovery) is documented in
[docs/runbooks/resend-marketing.md](docs/runbooks/resend-marketing.md).
