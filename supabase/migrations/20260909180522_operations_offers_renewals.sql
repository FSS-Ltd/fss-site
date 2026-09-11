-- Promoted through the approved Operations production release gate.
create table operations.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  outcome text not null check (length(trim(outcome)) between 1 and 2000),
  audience text not null check (length(trim(audience)) between 1 and 1000),
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  setup_needs text[] not null default '{}',
  support_hours text not null default '' check (length(support_hours) <= 1000),
  pricing_display text not null check (pricing_display in ('fixed','from','quote')),
  price_pence bigint check (price_pence is null or price_pence >= 0),
  recurrence text check (recurrence in ('one_off','monthly','quarterly','annual')),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pricing_display = 'quote' and price_pence is null) or (pricing_display <> 'quote' and price_pence is not null))
);

create table operations.offer_enquiries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id),
  offer_id uuid not null references operations.offers(id),
  created_by uuid not null,
  idempotency_key uuid not null,
  interest text not null check (length(trim(interest)) between 1 and 4000),
  context jsonb not null default '{}' check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 16000),
  state text not null default 'new' check (state in ('new','reviewing','proposed','closed')),
  owner_display text not null default 'Founder' check (length(owner_display) between 1 and 160),
  next_action text not null default 'Review enquiry' check (length(next_action) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (organisation_id, created_by, idempotency_key)
);

alter table operations.service_instances add constraint service_instances_organisation_id_id_key unique (organisation_id, id);

create table operations.retention_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id),
  service_instance_id uuid not null,
  agreement_id uuid not null references operations.agreements(id),
  kind text not null check (kind in ('renewal_60','renewal_30','renewal_14','risk_review')),
  due_date date not null,
  renewal_date date not null,
  notice_deadline date,
  goal text not null check (length(trim(goal)) between 1 and 2000),
  outcome text not null default '' check (length(outcome) <= 4000),
  risk_reason text not null default '' check (length(risk_reason) <= 2000),
  state text not null default 'open' check (state in ('open','dismissed','complete')),
  created_at timestamptz not null default now(),
  unique (service_instance_id, kind, renewal_date),
  foreign key (organisation_id, service_instance_id) references operations.service_instances(organisation_id, id),
  foreign key (organisation_id, agreement_id) references operations.agreements(organisation_id, id)
);

create index offer_enquiries_scope on operations.offer_enquiries (organisation_id, created_at desc, id);
create index retention_actions_due on operations.retention_actions (state, due_date, id) where state = 'open';

alter table operations.offers enable row level security;
alter table operations.offers force row level security;
alter table operations.offer_enquiries enable row level security;
alter table operations.offer_enquiries force row level security;
alter table operations.retention_actions enable row level security;
alter table operations.retention_actions force row level security;

revoke all on operations.offers, operations.offer_enquiries, operations.retention_actions from public, anon, authenticated, service_role, growth_app, operations_portal, operations_founder;
grant select on operations.offers to operations_portal;
grant select, insert on operations.offer_enquiries to operations_portal;
grant select, insert, update on operations.offers, operations.offer_enquiries, operations.retention_actions to operations_founder;

create policy portal_published_offers on operations.offers for select to operations_portal using (status = 'published');
create policy portal_enquiry_read on operations.offer_enquiries for select to operations_portal using (operations.portal_has_membership(organisation_id, array['owner','contributor','viewer']));
create policy portal_enquiry_insert on operations.offer_enquiries for insert to operations_portal with check (operations.portal_has_membership(organisation_id, array['owner','contributor']) and created_by = nullif(current_setting('operations.user_id', true), '')::uuid and exists (select 1 from operations.offers o where o.id = offer_id and o.status = 'published'));
create policy founder_offers on operations.offers to operations_founder using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_enquiries on operations.offer_enquiries to operations_founder using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_retention on operations.retention_actions to operations_founder using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');

create function operations.create_offer_enquiry(org uuid, offer uuid, request_key uuid, enquiry_interest text, enquiry_context jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; uid uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
begin
  if current_setting('role', true) <> 'operations_portal' or not operations.portal_has_membership(org, array['owner','contributor']) then raise exception 'Portal access is unavailable.' using errcode = '42501'; end if;
  if not exists (select 1 from operations.offers o where o.id = offer and o.status = 'published') then raise exception 'Offer unavailable.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text || uid::text || request_key::text, 13));
  select id into result from operations.offer_enquiries where organisation_id = org and created_by = uid and idempotency_key = request_key;
  if result is not null then return result; end if;
  insert into operations.offer_enquiries (organisation_id, offer_id, created_by, idempotency_key, interest, context) values (org, offer, uid, request_key, enquiry_interest, enquiry_context) returning id into result;
  return result;
end $$;
revoke all on function operations.create_offer_enquiry(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.create_offer_enquiry(uuid, uuid, uuid, text, jsonb) to operations_portal;
