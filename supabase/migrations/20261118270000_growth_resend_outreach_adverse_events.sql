begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep the existing email-wide suppression unique. A business-only row covers
-- other contacts even if its original email already belongs to another row.
alter table growth.suppressions alter column normalised_email drop not null;
alter table growth.suppressions add constraint business_only_suppression_shape check (
  normalised_email is not null or (business_id is not null and reason in ('bounce','do_not_contact'))
);
create unique index suppression_business_only_idx on growth.suppressions(business_id)
  where normalised_email is null;

-- One delivery receipt remains unique. Adverse events are independently
-- identified by the existing provider_event_id unique index and may follow it.
drop index growth.resend_outreach_event_reservation_idx;
drop index growth.resend_outreach_event_rfc_idx;
create unique index resend_outreach_event_reservation_idx on growth.resend_delivery_events(outreach_reservation_id)
  where outreach_reservation_id is not null and event_type='email.delivered';
create unique index resend_outreach_event_rfc_idx on growth.resend_delivery_events(outreach_connection_id,outreach_rfc_message_id)
  where outreach_reservation_id is not null and event_type='email.delivered';
alter table growth.resend_delivery_events drop constraint resend_outreach_event_shape;
alter table growth.resend_delivery_events add constraint resend_outreach_event_shape check ((
  (outreach_reservation_id is null and outreach_connection_id is null and outreach_webhook_generation is null and outreach_body_sha256 is null and outreach_rfc_message_id is null)
  or (outreach_reservation_id is not null and outreach_connection_id is not null and outreach_webhook_generation is not null
    and outreach_body_sha256 ~ '^[a-f0-9]{64}$' and length(outreach_rfc_message_id) between 3 and 998
    and event_type in ('email.delivered','email.bounced','email.complained') and email_message_id is not null and newsletter_send_id is null)
) is true);
commit;
