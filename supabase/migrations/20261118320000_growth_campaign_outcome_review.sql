begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table growth.outreach_events
  add column review_outcome_kind text,
  add column review_outcome_at timestamptz,
  add column review_meeting_activity_id uuid references growth.crm_activities(id) on delete restrict,
  add column review_proposal_event_id uuid references growth.commercial_stage_events(id) on delete restrict,
  add constraint outreach_outcome_review_shape check ((
    (event_type <> 'record_outcome' and review_outcome_kind is null and review_outcome_at is null and review_meeting_activity_id is null and review_proposal_event_id is null)
    or (event_type='record_outcome' and membership_id is not null and request_id is not null and review_outcome_at is not null
      and ((review_outcome_kind='meeting' and review_meeting_activity_id is not null and review_proposal_event_id is null)
        or (review_outcome_kind='proposal' and review_meeting_activity_id is null and review_proposal_event_id is not null)))
  ) is true);
create unique index outreach_review_meeting_source_idx on growth.outreach_events(review_meeting_activity_id) where review_meeting_activity_id is not null;
create unique index outreach_review_proposal_source_idx on growth.outreach_events(review_proposal_event_id) where review_proposal_event_id is not null;
commit;
