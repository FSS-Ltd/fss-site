-- Promoted through the approved Operations production release gate.
alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in ('organisation.created', 'engagement.linked', 'agreement.revised', 'agreement.signed', 'service.activated'));
alter table operations.audit_events add column correlation_id uuid;
alter table operations.audit_events add column entity_version integer;

create table operations.agreements (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references operations.organisations(id),
  engagement_id uuid not null, current_revision integer not null check (current_revision > 0),
  version integer not null default 1 check (version > 0), status text not null default 'draft' check (status in ('draft','signed')),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
  unique (organisation_id,id), foreign key (organisation_id,engagement_id) references operations.engagement_links(organisation_id,engagement_id)
);
create index agreements_organisation on operations.agreements(organisation_id,id);
create table operations.agreement_revisions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null, agreement_id uuid not null,
  revision integer not null check (revision > 0), snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by text not null check (created_by ~ '^[a-f0-9]{64}$'), correlation_id uuid not null, created_at timestamptz not null default now(),
  unique (organisation_id,agreement_id,revision), foreign key (organisation_id,agreement_id) references operations.agreements(organisation_id,id)
);
alter table operations.agreements add constraint current_revision_fk foreign key (organisation_id,id,current_revision) references operations.agreement_revisions(organisation_id,agreement_id,revision) deferrable initially deferred;
create table operations.agreement_lines (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null, agreement_id uuid not null, revision integer not null,
  line_number integer not null check (line_number between 1 and 30), service_code text not null, description text not null,
  quantity integer not null check(quantity > 0), unit_pence bigint not null check(unit_pence >= 0),
  discount_pence bigint not null check(discount_pence >= 0), tax_pence bigint not null check(tax_pence >= 0),
  total_pence numeric(30,0) generated always as (quantity::numeric * unit_pence - discount_pence + tax_pence) stored,
  recurrence_months integer not null check(recurrence_months in (0,1,3,12)), start_date date not null, end_date date,
  unique (organisation_id,agreement_id,revision,line_number),
  check(discount_pence <= quantity::numeric * unit_pence), check(end_date is null or end_date >= start_date),
  foreign key (organisation_id,agreement_id,revision) references operations.agreement_revisions(organisation_id,agreement_id,revision)
);
create table operations.signature_evidence (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null, agreement_id uuid not null, revision integer not null,
  provenance text not null default 'manual_founder_confirmation' check(provenance = 'manual_founder_confirmation'),
  evidence jsonb not null check(jsonb_typeof(evidence) = 'object'),
  created_by text not null check(created_by ~ '^[a-f0-9]{64}$'), correlation_id uuid not null, created_at timestamptz not null default now(),
  unique (organisation_id,agreement_id,revision), foreign key (organisation_id,agreement_id,revision) references operations.agreement_revisions(organisation_id,agreement_id,revision)
);
create table operations.service_instances (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null, agreement_id uuid not null, revision integer not null, line_number integer not null,
  effective_date date not null, end_date date, status text not null default 'active' check(status = 'active'),
  activation_evidence jsonb not null, provenance text not null default 'manual_founder_confirmation' check(provenance = 'manual_founder_confirmation'),
  created_by text not null check(created_by ~ '^[a-f0-9]{64}$'), correlation_id uuid not null, created_at timestamptz not null default now(),
  unique (organisation_id,agreement_id,revision,line_number),
  foreign key (organisation_id,agreement_id,revision,line_number) references operations.agreement_lines(organisation_id,agreement_id,revision,line_number),
  foreign key (organisation_id,agreement_id,revision) references operations.signature_evidence(organisation_id,agreement_id,revision)
);

-- Signed agreements cannot be rewritten; each draft edit appends a revision.
create function operations.guard_agreement_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'signed' and (new.current_revision <> old.current_revision or new.status <> old.status) then raise exception 'Signed revisions are immutable'; end if;
  if new.organisation_id <> old.organisation_id or new.engagement_id <> old.engagement_id or new.id <> old.id or new.created_by <> old.created_by or new.created_at <> old.created_at or new.version <> old.version + 1 then raise exception 'Invalid agreement update'; end if;
  if new.status = 'signed' and not exists(select 1 from operations.signature_evidence where organisation_id = new.organisation_id and agreement_id = new.id and revision = new.current_revision) then raise exception 'Signing evidence required'; end if;
  return new;
end $$;
create trigger guard_agreement_update before update on operations.agreements for each row execute function operations.guard_agreement_update();

create function operations.guard_agreement_evidence() returns trigger language plpgsql set search_path = '' as $$
declare a operations.agreements; s jsonb; l operations.agreement_lines; expected_line jsonb;
begin
  select * into strict a from operations.agreements where organisation_id = new.organisation_id and id = new.agreement_id for update;
  if tg_table_name = 'agreement_revisions' then
    if a.status <> 'draft' then raise exception 'Signed revisions are immutable'; end if;
    if jsonb_typeof(new.snapshot->'assetsRequired') is distinct from 'boolean'
      or jsonb_typeof(new.snapshot->'requiredDepositPence') is distinct from 'string'
      or coalesce(new.snapshot->>'requiredDepositPence','') !~ '^(0|[1-9][0-9]{0,17})$'
      then raise exception 'Valid activation requirements required'; end if;
    if jsonb_typeof(new.snapshot->'lines') is distinct from 'array' then raise exception 'Complete revision lines required'; end if;
    if jsonb_array_length(new.snapshot->'lines') not between 1 and 30 then raise exception 'Complete revision lines required'; end if;
    return new;
  end if;
  select snapshot into strict s from operations.agreement_revisions where organisation_id = new.organisation_id and agreement_id = new.agreement_id and revision = new.revision;
  if tg_table_name = 'agreement_lines' then
    expected_line := s->'lines'->(new.line_number-1);
    if a.status <> 'draft' or expected_line is null or
      jsonb_build_object('serviceCode',new.service_code,'description',new.description,'quantity',new.quantity,'unitPence',new.unit_pence::text,'discountPence',new.discount_pence::text,'taxPence',new.tax_pence::text,'recurrenceMonths',new.recurrence_months,'startDate',new.start_date::text,'endDate',new.end_date::text) is distinct from expected_line
      then raise exception 'Line must match the immutable revision snapshot'; end if;
    return new;
  end if;
  if new.revision <> a.current_revision then raise exception 'Revision conflict'; end if;
  if tg_table_name = 'signature_evidence' then
    if (select count(*) from operations.agreement_lines where organisation_id=new.organisation_id and agreement_id=new.agreement_id and revision=new.revision) <> jsonb_array_length(s->'lines') then raise exception 'Complete revision lines required'; end if;
    if a.status <> 'draft' or coalesce(s->>'documentHash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(s->'signatories') is distinct from 'array' or jsonb_array_length(s->'signatories') < 1 or coalesce(new.evidence->>'signedDocumentHash','') !~ '^[a-f0-9]{64}$' or new.evidence->>'confirmed' is distinct from 'true' or new.evidence->>'sourceHash' is distinct from s->>'documentHash'
      or new.evidence->'signatories' is distinct from s->'signatories'
      or coalesce(new.evidence->>'documentReference','') !~ '^private:[a-zA-Z0-9][a-zA-Z0-9/_-]*(\.[a-zA-Z0-9]+)?$'
      or (new.evidence->>'certificateReference' is not null and new.evidence->>'certificateReference' !~ '^private:[a-zA-Z0-9][a-zA-Z0-9/_-]*(\.[a-zA-Z0-9]+)?$')
      or new.evidence->>'signedDate' is null or (new.evidence->>'signedDate')::date > current_date then raise exception 'Complete matching manual signature evidence required'; end if;
  else
    if new.activation_evidence->>'effectiveDate' is distinct from new.effective_date::text then raise exception 'Effective date must match activation evidence'; end if;
    select * into strict l from operations.agreement_lines where organisation_id = new.organisation_id and agreement_id = new.agreement_id and revision = new.revision and line_number = new.line_number;
    if a.status <> 'signed' or new.effective_date < (select (e.evidence->>'signedDate')::date from operations.signature_evidence e where e.organisation_id=new.organisation_id and e.agreement_id=new.agreement_id and e.revision=new.revision) or new.effective_date < l.start_date or new.effective_date > current_date or (l.end_date is not null and new.effective_date > l.end_date) or new.end_date is distinct from l.end_date then raise exception 'Invalid effective service dates'; end if;
    if (s->>'assetsRequired')::boolean and new.activation_evidence->>'assetsReady' is distinct from 'true' then raise exception 'Required assets are not ready'; end if;
    if new.activation_evidence->'deposit' is not null and new.activation_evidence->'deposit' <> 'null'::jsonb and
      (jsonb_typeof(new.activation_evidence->'deposit'->'amountPence') is distinct from 'string' or coalesce(new.activation_evidence->'deposit'->>'amountPence','') !~ '^(0|[1-9][0-9]{0,17})$') then raise exception 'Valid deposit amount required'; end if;
    if (s->>'requiredDepositPence')::numeric > coalesce((new.activation_evidence->'deposit'->>'amountPence')::numeric,0) then raise exception 'Required deposit not verified'; end if;
    if new.activation_evidence->'deposit' <> 'null'::jsonb and (coalesce(new.activation_evidence->'deposit'->>'reference','') = '' or new.activation_evidence->'deposit'->>'verifiedDate' is null or (new.activation_evidence->'deposit'->>'verifiedDate')::date > new.effective_date) then raise exception 'Invalid deposit evidence'; end if;
  end if;
  return new;
end $$;
create trigger guard_revision before insert on operations.agreement_revisions for each row execute function operations.guard_agreement_evidence();
create trigger guard_line before insert on operations.agreement_lines for each row execute function operations.guard_agreement_evidence();
create trigger guard_signature before insert on operations.signature_evidence for each row execute function operations.guard_agreement_evidence();
create trigger guard_activation before insert on operations.service_instances for each row execute function operations.guard_agreement_evidence();

create function operations.audit_agreement_insert() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id,entity_version)
  values(new.organisation_id,new.created_by,case tg_table_name when 'agreement_revisions' then 'agreement.revised' when 'signature_evidence' then 'agreement.signed' else 'service.activated' end,new.agreement_id,'founder-register',new.correlation_id,new.revision);
  return new;
end $$;
create trigger audit_revision after insert on operations.agreement_revisions for each row execute function operations.audit_agreement_insert();
create trigger audit_signature after insert on operations.signature_evidence for each row execute function operations.audit_agreement_insert();
create trigger audit_activation after insert on operations.service_instances for each row execute function operations.audit_agreement_insert();

do $$ declare t text; begin
  foreach t in array array['agreements','agreement_revisions','agreement_lines','signature_evidence','service_instances'] loop
    execute format('alter table operations.%I enable row level security',t);
    execute format('alter table operations.%I force row level security',t);
    execute format('create policy founder_read on operations.%I for select to operations_founder using (current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
    if t = 'agreement_lines' then
      execute format('create policy founder_create on operations.%I for insert to operations_founder with check (current_setting(''operations.actor_id'',true) ~ ''^[a-f0-9]{64}$'')',t);
    else
      execute format('create policy founder_create on operations.%I for insert to operations_founder with check (created_by = current_setting(''operations.actor_id'',true))',t);
    end if;
    execute format('grant select,insert on operations.%I to operations_founder',t);
    execute format('revoke all on operations.%I from public,anon,authenticated,service_role,growth_app',t);
  end loop;
end $$;
create policy founder_update on operations.agreements for update to operations_founder using (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$') with check (current_setting('operations.actor_id',true) ~ '^[a-f0-9]{64}$');
grant update(current_revision,version,status) on operations.agreements to operations_founder;
revoke all on function operations.guard_agreement_update(),operations.guard_agreement_evidence(),operations.audit_agreement_insert() from public,anon,authenticated,service_role,growth_app,operations_founder;
