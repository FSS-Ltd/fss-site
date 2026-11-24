begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table growth.outreach_events
  add column review_inbound_message_id uuid references growth.email_messages(id) on delete restrict,
  add column review_reply_kind text,
  add constraint outreach_reply_review_shape check (
    (review_inbound_message_id is null and review_reply_kind is null and event_type <> 'record_reply')
    or (event_type = 'record_reply' and review_inbound_message_id is not null
      and membership_id is not null and request_id is not null
      and review_reply_kind in ('positive', 'negative', 'bot', 'out_of_office', 'opt_out', 'unknown'))
  );
create unique index outreach_reply_review_message_idx
  on growth.outreach_events(review_inbound_message_id) where review_inbound_message_id is not null;

commit;
