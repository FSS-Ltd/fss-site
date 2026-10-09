-- New invitations use the same 30-day lifetime in Operations and Clerk.
-- Existing invitation expiry timestamps are deliberately unchanged.
alter table operations.pending_portal_invitations
  alter column expires_at set default (now() + interval '30 days');
alter table operations.pending_staff_invitations
  alter column expires_at set default (now() + interval '30 days');
alter table operations.portal_invites
  alter column expires_at set default (now() + interval '30 days');

-- Keep the staff register behind its existing founder-only function boundary.
drop function operations.founder_staff_access_register();
create function operations.founder_staff_access_register()
returns table (
  id uuid, name text, email text, user_id uuid, membership_id uuid,
  state text, invited_at timestamptz, joined_at timestamptz, expires_at timestamptz
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
      i.created_at, m.granted_at, i.expires_at
    from operations.pending_staff_invitations i
    left join operations.staff_memberships m on m.invitation_id = i.id
    where i.dismissed_at is null or m.id is not null;
end;
$$;
revoke all on function operations.founder_staff_access_register()
  from public, anon, authenticated, service_role, growth_app, operations_founder, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.founder_staff_access_register() to operations_founder;

create or replace function operations.issue_portal_invite(
  target_organisation uuid, target_contact uuid, invited_role text,
  invite_hash text, review text
) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  actor text := current_setting('operations.actor_id', true);
  invitation operations.portal_invites;
  expiry timestamptz := now() + interval '30 days';
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder authorization is required.'; end if;
  perform 1 from operations.contacts c join operations.organisations o on o.id = c.organisation_id
    where c.id = target_contact and c.organisation_id = target_organisation and o.lifecycle = 'active' for update of c;
  if not found then raise exception 'Contact unavailable.'; end if;
  for invitation in update operations.portal_invites set revoked_at = now()
    where contact_id = target_contact and claimed_at is null and revoked_at is null returning * loop
    insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
      values (target_organisation, actor, 'invite.revoked', invitation.id, review);
  end loop;
  insert into operations.portal_invites (organisation_id, contact_id, role, token_hash, expires_at, created_by, review_reference)
    values (target_organisation, target_contact, invited_role, invite_hash, expiry, actor, review) returning * into invitation;
  insert into operations.audit_events (organisation_id, actor_id, action, entity_id, review_reference)
    values (target_organisation, actor, 'invite.issued', invitation.id, review);
  return expiry;
end;
$$;

-- A resend is bound to the selected row, so a stale browser request cannot
-- replace a newer invitation or an accepted membership.
create function operations.resend_portal_invitation(
  previous_id uuid, replacement_id uuid, review text, correlation uuid,
  decline_hash text
) returns table(invitation_name text, invitation_email text)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  prior operations.pending_portal_invitations;
  replacement record;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Staff authorization is required.' using errcode = '42501'; end if;
  if previous_id is null or replacement_id is null or correlation is null or decline_hash is null
    or review is null or length(trim(review)) not between 1 and 200 then
    raise exception 'Invitation review is invalid.' using errcode = '22023';
  end if;
  select * into prior from operations.pending_portal_invitations where id = previous_id;
  if not found then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.portal:' || prior.email, 0));
  select * into prior from operations.pending_portal_invitations where id = previous_id for update;
  if prior.state <> 'pending' or prior.dismissed_at is not null or
    exists (
      select 1 from operations.memberships m
      join operations.contacts c on c.id = m.contact_id and c.organisation_id = m.organisation_id
      where m.organisation_id = prior.target_organisation_id
        and c.email = prior.email and m.revoked_at is null
    ) then
    raise exception 'Invitation unavailable.' using errcode = 'P0002';
  end if;
  select * into replacement from operations.issue_pending_portal_invitation(
    replacement_id, prior.name, prior.email, prior.role, trim(review),
    correlation, prior.target_organisation_id
  );
  perform operations.attach_portal_decline_token(replacement.id, decline_hash, correlation);
  insert into operations.portal_invitation_audit
    (invitation_id, actor_id, action, correlation_id, review_reference)
    values (previous_id, actor, 'revoked', correlation, trim(review));
  return query select prior.name, prior.email;
end;
$$;

create function operations.resend_staff_invitation(
  previous_id uuid, replacement_id uuid, review text, correlation uuid
) returns table(invitation_name text, invitation_email text)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := nullif(current_setting('operations.actor_id', true), '');
  prior operations.pending_staff_invitations;
begin
  if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Staff authorization is required.' using errcode = '42501'; end if;
  if previous_id is null or replacement_id is null or correlation is null
    or review is null or length(trim(review)) not between 1 and 200 then
    raise exception 'Invitation review is invalid.' using errcode = '22023';
  end if;
  select * into prior from operations.pending_staff_invitations where id = previous_id;
  if not found then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('operations.staff:' || prior.email, 0));
  select * into prior from operations.pending_staff_invitations where id = previous_id for update;
  if prior.state <> 'pending' or prior.dismissed_at is not null or exists (
    select 1 from operations.staff_memberships
    where invitation_id = previous_id and revoked_at is null
  ) then raise exception 'Invitation unavailable.' using errcode = 'P0002'; end if;
  perform operations.issue_staff_invitation(
    replacement_id, prior.name, prior.email, trim(review), correlation
  );
  return query select prior.name, prior.email;
end;
$$;

revoke all on function operations.resend_portal_invitation(uuid,uuid,text,uuid,text),
  operations.resend_staff_invitation(uuid,uuid,text,uuid)
  from public, anon, authenticated, service_role, growth_app, operations_portal;
grant execute on function operations.resend_portal_invitation(uuid,uuid,text,uuid,text),
  operations.resend_staff_invitation(uuid,uuid,text,uuid) to operations_founder;
