-- A rejected historical attempt is not proof that Gmail was never invoked.
alter table growth.email_messages add column outreach_guarded_claim boolean not null default false;
alter table growth.outreach_reservations
  add column direct_noninvocation_evidence jsonb,
  add constraint direct_noninvocation_identity check (
    direct_noninvocation_evidence is null or (
      status = 'rejected' and issued_snapshot is not null and direct_submission_evidence is null
      and direct_noninvocation_evidence->>'reason' in ('invalid_input','guard_rejected','credential_preparation_failed')
      and direct_noninvocation_evidence = jsonb_build_object(
        'version', 1, 'kind', 'gmail_send_not_invoked_v1', 'reservationId', id::text,
        'reason', direct_noninvocation_evidence->>'reason'
      )
    ) is true
  );
create function growth.protect_direct_noninvocation() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.direct_noninvocation_evidence is not null then raise exception 'non-invocation requires existing reservation'; end if;
    return new;
  end if;
  if old.direct_noninvocation_evidence is not null and new.direct_noninvocation_evidence is distinct from old.direct_noninvocation_evidence then
    raise exception 'non-invocation evidence is immutable';
  end if;
  if old.direct_noninvocation_evidence is null and new.direct_noninvocation_evidence is not null and not (
    old.status = 'submitting' and new.status = 'rejected' and old.issued_snapshot is not null
  ) then raise exception 'non-invocation evidence requires submitting to rejected transition'; end if;
  return new;
end $$;
create trigger protect_direct_noninvocation before insert or update on growth.outreach_reservations
for each row execute function growth.protect_direct_noninvocation();
