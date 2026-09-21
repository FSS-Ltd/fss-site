-- A contact title is operational context only. It does not grant portal access
-- or determine a membership role, which remain separate, explicit workflows.
alter table operations.contacts
  add column job_title text
  check (job_title is null or length(trim(job_title)) between 1 and 200);
