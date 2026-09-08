# Stripe sandbox contract fixtures

Captured on 8 September 2026 from actual Stripe test-account events using API `2026-08-26.dahlia`. The authenticated Stripe CLI forwarded the original bytes to a loopback verifier using stripe-node 22.6.1. Every retained event has `livemode: false`.

`manifest.json` records event type, source SHA-256 and every redacted JSON path. Hosted URLs, client secrets, IP addresses and user agents are replaced by `[redacted]`. Remaining names, addresses and payment data came from synthetic fixtures or Stripe-documented test cases. The provider object structure and non-sensitive values remain unchanged.

These are contract fixtures, not valid original-signature payloads after redaction. Signature replay, tampering and freshness were tested against the private original bytes. `payment_intent-payment_failed-insufficient_funds.json` comes from the explicit future-reuse case; its authoritative mandate remained active. The debit-not-authorised case ended with an inactive mandate. Application recovery must fetch current state rather than assume event order or mandate availability.

See [provider gate evidence](../../../../docs/operations/provider-sandbox-results.md) for exact scope, cleanup and live-activation limits. Task 8 adds the persistent ledger/replay/reconciliation tests; this fixture collection does not claim that implementation exists.
