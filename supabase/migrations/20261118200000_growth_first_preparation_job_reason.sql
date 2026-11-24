begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table growth.outreach_jobs
  add column last_error_code text
    check (last_error_code is null or last_error_code ~ '^[a-z][a-z0-9_]{0,99}$');

commit;
