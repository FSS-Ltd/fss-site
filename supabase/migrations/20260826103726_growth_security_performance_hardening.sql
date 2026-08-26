-- Cover every Growth OS foreign key reported by the Supabase database linter.
-- Composite indexes preserve the foreign-key column order so referenced-row
-- updates and deletes can verify dependants without scanning whole tables.

create index if not exists client_messages_recipient_contact_id_idx
  on growth.client_messages (recipient_contact_id);

create index if not exists email_messages_asset_prospect_idx
  on growth.email_messages (email_asset_id, prospect_id);

create index if not exists email_messages_enrollment_identity_idx
  on growth.email_messages (sequence_enrollment_id, prospect_id, contact_id);

create index if not exists newsletter_issues_email_asset_id_idx
  on growth.newsletter_issues (email_asset_id);

create index if not exists newsletter_sends_subscriber_id_idx
  on growth.newsletter_sends (subscriber_id);

create index if not exists prospects_primary_contact_business_idx
  on growth.prospects (primary_contact_id, business_id);

create index if not exists sequence_enrollments_first_message_idx
  on growth.sequence_enrollments (first_message_id, id);

create index if not exists sequence_enrollments_prospect_contact_idx
  on growth.sequence_enrollments (prospect_id, contact_id);

-- This Supabase-managed event-trigger function is SECURITY DEFINER. Event
-- triggers do not require client roles to execute the function directly, so
-- remove its inherited RPC surface while leaving the event trigger intact.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end
$$;
