begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table growth.outreach_account_controls
  drop constraint outreach_account_controls_provider_check,
  alter column verified_subject drop not null,
  alter column verified_grant_epoch drop not null,
  alter column verified_scopes drop not null,
  add column resend_team text,
  add column resend_environment text,
  add column resend_binding jsonb,
  add column resend_binding_review_id uuid,
  add constraint outreach_account_provider_shape check ((
    (provider = 'gmail' and verified_subject is not null and verified_grant_epoch is not null and verified_scopes is not null
      and resend_team is null and resend_environment is null and resend_binding is null and resend_binding_review_id is null)
    or
    (provider = 'resend' and verified_subject is null and verified_grant_epoch is null and verified_scopes is null
      and length(trim(resend_team)) between 1 and 200 and resend_environment in ('production','preview','development')
      and jsonb_typeof(resend_binding) = 'object'
      and resend_binding->>'team' = resend_team and resend_binding->>'environment' = resend_environment)
  ) is true),
  add constraint resend_binding_review_fk foreign key (resend_binding_review_id, connection_id)
    references growth.outreach_account_reviews(id, connection_id) on delete restrict;
create unique index outreach_resend_team_environment_unique
  on growth.outreach_account_controls(resend_team, resend_environment) where provider='resend';

alter table growth.outreach_account_reviews
  drop constraint outreach_account_reviews_kind_check,
  add constraint outreach_account_reviews_kind_check
    check (kind in ('record_limits','record_health','activate','approve_ramp','reduce_ramp','halt','revalidate_grant','resend_configure'));

alter table growth.outreach_provider_usage
  add column resend_usage jsonb check (resend_usage is null or jsonb_typeof(resend_usage) = 'object'),
  add column resend_usage_generation uuid,
  add constraint resend_usage_generation_pair check (
    (resend_usage is null and resend_usage_generation is null)
    or (resend_usage is not null and resend_usage_generation is not null)
  );

create function growth.protect_resend_account_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.provider='resend' and
    (new.provider, new.connection_id, new.resend_team, new.resend_environment) is distinct from
    (old.provider, old.connection_id, old.resend_team, old.resend_environment) then
    raise exception 'resend account identity is immutable';
  end if;
  return new;
end $$;
create trigger protect_resend_account_identity before update on growth.outreach_account_controls
  for each row execute function growth.protect_resend_account_identity();

create function growth.protect_resend_connection_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.provider='resend' and exists (
    select 1 from growth.outreach_account_controls c where c.connection_id=old.id and c.provider='resend'
  ) and (new.provider,new.id,new.subject_email) is distinct from (old.provider,old.id,old.subject_email) then
    raise exception 'resend connection identity is immutable';
  end if;
  return new;
end $$;
create trigger protect_resend_connection_identity before update on growth.integration_connections
  for each row execute function growth.protect_resend_connection_identity();
commit;
