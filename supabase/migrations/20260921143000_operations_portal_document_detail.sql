-- The client document-detail projection includes its public revision number.
-- All other document-detail fields continue to be protected by column grants.
grant select (version) on operations.documents to operations_portal;
