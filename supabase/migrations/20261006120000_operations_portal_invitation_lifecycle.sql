-- Keep invitation history while allowing staff to clear the working register.
alter table operations.pending_portal_invitations
  add column decline_token_hash text unique check (decline_token_hash ~ '^[a-f0-9]{64}$'),
  add column declined_at timestamptz,
  add column dismissed_at timestamptz;
alter table operations.pending_portal_invitations
  drop constraint pending_portal_invitations_state_check;
alter table operations.pending_portal_invitations
  add constraint pending_portal_invitations_state_check
  check (state in ('pending', 'accepted', 'declined', 'provider_failed', 'completed', 'revoked')),
  add constraint pending_portal_invitations_declined_check
  check ((state = 'declined') = (declined_at is not null));
alter table operations.pending_staff_invitations add column dismissed_at timestamptz;
alter table operations.portal_invites add column dismissed_at timestamptz;
alter table operations.portal_invitation_audit drop constraint portal_invitation_audit_action_check;
alter table operations.portal_invitation_audit add column review_reference text
  check (review_reference is null or length(trim(review_reference)) between 1 and 200);
alter table operations.portal_invitation_audit add constraint portal_invitation_audit_action_check
  check (action in ('issued', 'revoked', 'provider_failed', 'completed', 'declined', 'dismissed'));
alter table operations.staff_invitation_audit drop constraint staff_invitation_audit_action_check;
alter table operations.staff_invitation_audit add constraint staff_invitation_audit_action_check
  check (action in ('issued', 'provider_failed', 'completed', 'revoked', 'dismissed'));
alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in (
  'organisation.created', 'engagement.linked', 'agreement.revised',
  'agreement.signed', 'service.activated', 'contact.created', 'invite.issued',
  'invite.revoked', 'invite.claimed', 'invite.dismissed', 'membership.revoked',
  'project.created', 'project.updated', 'milestone.created', 'milestone.updated',
  'document.created', 'document.updated', 'billing.billing_customers.created',
  'billing.billing_schedules.created', 'billing.billing_commands.created',
  'billing.invoices.created', 'billing.billing_amendment_previews.created',
  'onboarding.retry_requested', 'onboarding.template_published',
  'onboarding.journey_draft_saved', 'onboarding.booking_confirmed',
  'onboarding.client_profile_completed', 'onboarding.journey_draft_discarded',
  'agreement.draft_saved', 'agreement.draft_finalised',
  'organisation.currency_changed'
));

-- Called in the same transaction as issuing a client invitation. Only its issuer
-- can attach the hash; the raw token exists only in the server and email URL.
create function operations.attach_portal_decline_token(target_id uuid, token_hash text, correlation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  verified_user uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  owner_actor text;
begin
  if verified_user is not null then
    owner_actor := encode(sha256(convert_to(verified_user::text, 'UTF8')), 'hex');
  end if;
  if token_hash is null or token_hash !~ '^[a-f0-9]{64}$' or correlation is null then
    raise exception 'Invalid decline token.' using errcode = '22023';
  end if;
  update operations.pending_portal_invitations
    set decline_token_hash = token_hash
    where id = target_id and correlation_id = correlation and state = 'pending'
      and decline_token_hash is null and (created_by = actor or created_by = owner_actor);
  if not found then raise exception 'Invitation unavailable.' using errcode = '42501'; end if;
end;
$$;

-- The token is a bearer capability. It only changes an unaccepted invitation.
create function operations.decline_portal_invitation(token_hash text, correlation uuid)
returns table(invitation_id uuid, invitation_email text)
language plpgsql security definer set search_path = '' as $$
declare
  invitation operations.pending_portal_invitations;
begin
  if token_hash is null or token_hash !~ '^[a-f0-9]{64}$' or correlation is null then return; end if;
  select * into invitation from operations.pending_portal_invitations where decline_token_hash = token_hash;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || invitation.email, 0));
  select * into invitation from operations.pending_portal_invitations where id = invitation.id for update;
  if invitation.dismissed_at is not null or invitation.expires_at <= clock_timestamp()
    or invitation.state not in ('pending', 'declined') then return; end if;
  if invitation.state = 'pending' then
    update operations.pending_portal_invitations
      set state = 'declined', declined_at = clock_timestamp()
      where id = invitation.id;
    insert into operations.portal_invitation_audit(invitation_id, actor_id, action, correlation_id)
      values (invitation.id, encode(sha256(convert_to('decline:' || token_hash, 'UTF8')), 'hex'), 'declined', correlation);
  end if;
  return query select invitation.id, invitation.email;
end;
$$;

-- Consume the bearer token only after Clerk confirms cleanup. A failed provider
-- call leaves it available for an idempotent retry of the declined row.
create function operations.complete_portal_invitation_decline(token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if token_hash is null or token_hash !~ '^[a-f0-9]{64}$' then return; end if;
  update operations.pending_portal_invitations set decline_token_hash = null
    where decline_token_hash = token_hash and state = 'declined';
end;
$$;

-- The application calls prepare, revokes any matching pending Clerk invitation,
-- then calls finish. A provider error leaves the row visible for a safe retry.
create function operations.prepare_access_invitation_delete(
  invitation_kind text, target_id uuid, review text, correlation uuid
) returns table(invitation_email text)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  client_invitation operations.pending_portal_invitations;
  staff_invitation operations.pending_staff_invitations;
  legacy_invitation operations.portal_invites;
  target_email text;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Staff authorization is required.' using errcode = '42501'; end if;
  if target_id is null or correlation is null or review is null or length(trim(review)) not between 1 and 200 then
    raise exception 'Deletion review is invalid.' using errcode = '22023';
  end if;
  if invitation_kind = 'client' then
    select email into target_email from operations.pending_portal_invitations where id = target_id;
    if target_email is null then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || target_email, 0));
    select * into client_invitation from operations.pending_portal_invitations where id = target_id for update;
    if client_invitation.state in ('accepted', 'completed') or client_invitation.dismissed_at is not null then
      raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    if client_invitation.state = 'pending' then
      update operations.pending_portal_invitations set state = 'revoked' where id = target_id;
      insert into operations.portal_invitation_audit(invitation_id, actor_id, action, correlation_id, review_reference)
        values (target_id, actor, 'revoked', correlation, trim(review));
    end if;
    return query select client_invitation.email;
  elsif invitation_kind = 'staff' then
    select email into target_email from operations.pending_staff_invitations where id = target_id;
    if target_email is null then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || target_email, 0));
    select * into staff_invitation from operations.pending_staff_invitations where id = target_id for update;
    if staff_invitation.state = 'completed' or staff_invitation.dismissed_at is not null
      or exists(select 1 from operations.staff_memberships where invitation_id = target_id) then
      raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    if staff_invitation.state = 'pending' then
      update operations.pending_staff_invitations set state = 'revoked', revoked_at = clock_timestamp() where id = target_id;
      insert into operations.staff_invitation_audit(invitation_id, actor_id, action, review_reference, correlation_id)
        values (target_id, actor, 'revoked', trim(review), correlation);
    end if;
    return query select staff_invitation.email;
  elsif invitation_kind = 'legacy' then
    select * into legacy_invitation from operations.portal_invites where id = target_id for update;
    if not found or legacy_invitation.claimed_at is not null or legacy_invitation.dismissed_at is not null then
      raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    if legacy_invitation.revoked_at is null then
      update operations.portal_invites set revoked_at = clock_timestamp() where id = target_id;
      insert into operations.audit_events(organisation_id, actor_id, action, entity_id, review_reference, correlation_id)
        values (legacy_invitation.organisation_id, actor, 'invite.revoked', target_id, trim(review), correlation);
    end if;
    return query select c.email from operations.contacts c where c.id = legacy_invitation.contact_id;
  else
    raise exception 'Invitation kind is invalid.' using errcode = '22023';
  end if;
end;
$$;

create function operations.finish_access_invitation_delete(
  invitation_kind text, target_id uuid, review text, correlation uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  organisation uuid;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' or target_id is null or correlation is null
    or review is null or length(trim(review)) not between 1 and 200 then
    raise exception 'Deletion review is invalid.' using errcode = '42501';
  end if;
  if invitation_kind = 'client' then
    update operations.pending_portal_invitations set dismissed_at = clock_timestamp()
      where id = target_id and dismissed_at is null and state in ('revoked', 'declined', 'provider_failed');
    if not found then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    insert into operations.portal_invitation_audit(invitation_id, actor_id, action, correlation_id, review_reference)
      values (target_id, actor, 'dismissed', correlation, trim(review));
  elsif invitation_kind = 'staff' then
    update operations.pending_staff_invitations set dismissed_at = clock_timestamp()
      where id = target_id and dismissed_at is null and state in ('revoked', 'provider_failed')
        and not exists(select 1 from operations.staff_memberships where invitation_id = target_id);
    if not found then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    insert into operations.staff_invitation_audit(invitation_id, actor_id, action, review_reference, correlation_id)
      values (target_id, actor, 'dismissed', trim(review), correlation);
  elsif invitation_kind = 'legacy' then
    update operations.portal_invites set dismissed_at = clock_timestamp()
      where id = target_id and dismissed_at is null and revoked_at is not null and claimed_at is null
      returning organisation_id into organisation;
    if not found then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
    insert into operations.audit_events(organisation_id, actor_id, action, entity_id, review_reference, correlation_id)
      values (organisation, actor, 'invite.dismissed', target_id, trim(review), correlation);
  else
    raise exception 'Invitation kind is invalid.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function operations.attach_portal_decline_token(uuid,text,uuid),
  operations.decline_portal_invitation(text,uuid),
  operations.complete_portal_invitation_decline(text),
  operations.prepare_access_invitation_delete(text,uuid,text,uuid),
  operations.finish_access_invitation_delete(text,uuid,text,uuid)
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal;
grant execute on function operations.attach_portal_decline_token(uuid,text,uuid) to operations_founder, operations_portal;
grant execute on function operations.decline_portal_invitation(text,uuid) to operations_portal;
grant execute on function operations.complete_portal_invitation_decline(text) to operations_portal;
grant execute on function operations.prepare_access_invitation_delete(text,uuid,text,uuid),
  operations.finish_access_invitation_delete(text,uuid,text,uuid) to operations_founder;

create or replace function operations.founder_staff_access_register()
returns table (
  id uuid, name text, email text, user_id uuid, membership_id uuid,
  state text, invited_at timestamptz, joined_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare actor text := nullif(current_setting('operations.actor_id', true), '');
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  return query
    select i.id, i.name, i.email, m.user_id, m.id,
      case
        when i.state = 'revoked' or m.revoked_at is not null then 'revoked'
        when i.state = 'completed' and m.id is not null then 'active'
        when i.state = 'pending' and i.expires_at <= now() then 'expired'
        else i.state
      end,
      i.created_at, m.granted_at
    from operations.pending_staff_invitations i
    left join operations.staff_memberships m on m.invitation_id = i.id
    where i.dismissed_at is null or m.id is not null;
end;
$$;
