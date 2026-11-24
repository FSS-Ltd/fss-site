begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Scheduling only: accepted evidence and receipts remain authoritative and immutable.
alter table growth.outreach_reservations
  add column confirmation_next_attempt_at timestamptz;

create index outreach_reservation_confirmation_due_idx
  on growth.outreach_reservations
  (connection_id, (coalesce(confirmation_next_attempt_at, completed_at)), id)
  where status = 'accepted' and direct_submission_evidence is not null
    and confirmation_receipt is null and confirmation_observed_at is null
    and completed_at is not null;
commit;
