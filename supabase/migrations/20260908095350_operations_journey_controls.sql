-- Promoted through the approved Operations production release gate. Preserve SELECT-only founder table grants.
create function operations.lock_onboarding_founder(org uuid, journey uuid, expected_generation integer, expected_proposal uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor text:=current_setting('operations.actor_id',true);
begin
 if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder approval required' using errcode='42501'; end if;
 perform 1 from operations.onboarding_journeys where id=journey and organisation_id=org and generation=expected_generation and proposal_approval_id is not distinct from expected_proposal for update;
 if not found then raise exception 'Journey changed or unavailable'; end if;
end $$;
revoke all on function operations.lock_onboarding_founder(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role,growth_app,operations_portal,operations_onboarding_worker;
grant execute on function operations.lock_onboarding_founder(uuid,uuid,integer,uuid) to operations_founder;

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check (action in ('organisation.created','engagement.linked','agreement.revised','agreement.signed','service.activated','contact.created','invite.issued','invite.revoked','invite.claimed','membership.revoked','project.created','project.updated','milestone.created','milestone.updated','document.created','document.updated','billing.billing_customers.created','billing.billing_schedules.created','billing.billing_commands.created','billing.invoices.created','billing.billing_amendment_previews.created','onboarding.retry_requested'));
create function operations.retry_onboarding_failure(org uuid, journey uuid, job uuid, review_reference text)
returns void language plpgsql security definer set search_path='' as $$
declare actor text:=current_setting('operations.actor_id',true); b operations.onboarding_jobs;
begin
 if actor is null or actor !~ '^[a-f0-9]{64}$' then raise exception 'Founder approval required' using errcode='42501'; end if;
 perform 1 from operations.onboarding_journeys where id=journey and organisation_id=org and state='active' for update;
 if not found then raise exception 'Resume an eligible journey before recovery'; end if;
 select * into strict b from operations.onboarding_jobs where id=job and journey_id=journey and organisation_id=org for update;
 if b.state<>'held' or b.attempts>=6 or b.failure_code not in ('transport','rate_limited','configuration','invalid_contract') or not exists(select 1 from operations.onboarding_effects where job_id=job and status='held' and not unresolved_acceptance) then raise exception 'Only a definite recoverable failure can retry'; end if;
 if length(trim(review_reference)) not between 1 and 200 then raise exception 'Review reference required'; end if;
 insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id) values(org,actor,'onboarding.retry_requested',job,review_reference,gen_random_uuid());
 update operations.onboarding_jobs set state='pending',failure_code=null,next_attempt_at=clock_timestamp(),lease_token=null,lease_until=null where id=job;
 -- Keep the original effect, attempts, approved content, and permanent provider key.
end $$;
revoke all on function operations.retry_onboarding_failure(uuid,uuid,uuid,text) from public,anon,authenticated,service_role,growth_app,operations_portal,operations_onboarding_worker;
grant execute on function operations.retry_onboarding_failure(uuid,uuid,uuid,text) to operations_founder;
