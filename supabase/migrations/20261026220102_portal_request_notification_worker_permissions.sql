begin;

-- The Operations cron uses the onboarding worker, rather than the founder login.
-- Allow only the existing request delivery procedures; table access stays revoked.
grant execute on function
  operations.dispatch_request_notifications(integer),
  operations.claim_request_emails(integer),
  operations.complete_request_email(uuid, text, timestamptz),
  operations.fail_request_email(uuid, text, timestamptz, boolean)
  to operations_onboarding_worker;

commit;
