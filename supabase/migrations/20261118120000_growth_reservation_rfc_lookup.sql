-- Support bounded exact reply-reference lookup without scanning reservations.
create index outreach_reservation_rfc_lookup on growth.outreach_reservations(rfc_message_id)
  where rfc_message_id is not null;
