set lock_timeout = '5s';

alter table growth.outreach_events
  add column request_id uuid,
  add column request_hash text,
  add column actor_id text,
  add column result_id uuid,
  add constraint outreach_event_request_check check (
    (request_id is null and request_hash is null and actor_id is null and result_id is null)
    or (request_id is not null and request_hash is not null and request_hash ~ '^[a-f0-9]{64}$' and actor_id is not null and actor_id ~ '^[a-f0-9]{64}$' and result_id is not null)
  );
create unique index outreach_event_request_idx on growth.outreach_events(request_id) where request_id is not null;

alter table growth.outreach_permissions
  add column contact_id uuid references growth.contacts(id) on delete restrict,
  add column proof_request_id uuid,
  add constraint outreach_permission_proof_pair_check check ((contact_id is null) = (proof_request_id is null));

reset lock_timeout;
