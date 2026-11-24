set lock_timeout = '5s';

alter table growth.integration_connections
  add column google_subject text check (
    google_subject is null or (
      provider = 'gmail' and length(trim(google_subject)) between 1 and 255
    )
  );
