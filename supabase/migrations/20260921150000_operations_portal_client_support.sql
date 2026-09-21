create table operations.portal_support_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references operations.organisations(id),
  user_id uuid not null,
  reference text not null unique check (reference ~ '^FSS-SUP-[A-F0-9]{32}$'),
  category text not null check (category in ('project_question','incident','workspace_access','billing','other')),
  subject text not null check (length(trim(subject)) between 1 and 160),
  message text not null check (length(trim(message)) between 1 and 10000),
  idempotency_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (organisation_id, user_id, idempotency_key)
);

alter table operations.portal_support_requests enable row level security;
alter table operations.portal_support_requests force row level security;
revoke all on operations.portal_support_requests from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal;

create function operations.create_portal_support_request(
  target_organisation uuid,
  target_category text,
  target_subject text,
  target_message text,
  target_idempotency_key uuid
) returns table(id uuid, reference text)
language plpgsql security definer set search_path = '' as $$
declare
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  created_id uuid;
begin
  if current_setting('role', true) <> 'operations_portal'
    or verified_user is null
    or not operations.portal_has_membership(target_organisation, array['owner','contributor','billing_contact','viewer'])
  then raise exception 'Portal access is unavailable.' using errcode = '42501'; end if;
  if target_category not in ('project_question','incident','workspace_access','billing','other')
    or target_subject is null or length(trim(target_subject)) not between 1 and 160
    or target_message is null or length(trim(target_message)) not between 1 and 10000
    or target_idempotency_key is null
  then raise exception 'Support request is invalid.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organisation::text || verified_user::text || target_idempotency_key::text, 19));
  select r.id into created_id from operations.portal_support_requests r
    where r.organisation_id = target_organisation and r.user_id = verified_user and r.idempotency_key = target_idempotency_key;
  if created_id is null then
    created_id := gen_random_uuid();
    insert into operations.portal_support_requests(id, organisation_id, user_id, reference, category, subject, message, idempotency_key)
      values(created_id, target_organisation, verified_user, 'FSS-SUP-' || upper(replace(created_id::text, '-', '')), target_category, trim(target_subject), trim(target_message), target_idempotency_key);
  end if;
  return query select r.id, r.reference from operations.portal_support_requests r
    where r.organisation_id = target_organisation and r.user_id = verified_user and r.id = created_id;
end;
$$;

create function operations.portal_current_profile(target_organisation uuid)
returns table(display_name text, email text, organisation_name text, timezone text, role text, request_email_enabled boolean)
language plpgsql security definer set search_path = '' as $$
declare verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
begin
  if current_setting('role', true) <> 'operations_portal' or verified_user is null
    or not operations.portal_has_membership(target_organisation, array['owner','contributor','billing_contact','viewer'])
  then raise exception 'Portal access is unavailable.' using errcode = '42501'; end if;
  return query select coalesce(p.display_name, c.name),
    coalesce(p.email, nullif(current_setting('operations.verified_email', true), '')),
    o.display_name, o.timezone, m.role,
    coalesce(np.request_email_enabled, true)
    from operations.memberships m
    join operations.contacts c on c.id = m.contact_id and c.organisation_id = m.organisation_id
    join operations.organisations o on o.id = m.organisation_id
    left join operations.user_profiles p on p.user_id = m.user_id
    left join operations.notification_preferences np on np.organisation_id = m.organisation_id and np.user_id = m.user_id
    where m.organisation_id = target_organisation and m.user_id = verified_user and m.revoked_at is null;
end;
$$;

revoke all on function operations.create_portal_support_request(uuid,text,text,text,uuid), operations.portal_current_profile(uuid) from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.create_portal_support_request(uuid,text,text,text,uuid), operations.portal_current_profile(uuid) to operations_portal;
