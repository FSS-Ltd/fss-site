# Outreach payment evidence

Scheduled campaign reports keep payment coverage unknown. A paid invoice or a positive invoice balance is not proof of an attributable net payment for the campaign.

The current Operations chain links a Growth engagement to an organisation, signed agreement revision, billing schedule and invoice. A payment allocation can link an invoice to a succeeded payment, but it does not record when that allocation became effective. `lib/operations/billing/stripe-projections.ts` sets `confirmedAt` from an allocation's `paid_at` when present, falling back to a charge or payment-intent creation time without retaining which source was used. Those fallback times do not establish payment confirmation.

Refunds, disputes and invoice credits retain current status and projection time, not a complete effective-time history. A reconciliation cursor is not a historical completeness guarantee. Shared allocations and later adjustments therefore cannot be safely apportioned at a past report cutoff. Signed agreement lines also lack a canonical binding to the frozen campaign offer and terms. Existing Operations metrics explicitly leave historical receivables and period net refunds unavailable for these reasons.

A future implementation needs verified payment-event timing and provenance, complete adjustment evidence for the relevant cutoff, an exact reviewed offer-to-agreement binding, unique membership attribution, and a narrowly authorised report reader with a coherent transaction boundary. The separate Growth and Operations connections do not establish that boundary. No such payment evidence source or automatic attribution is implemented here, and no additional Operations permissions are granted.
