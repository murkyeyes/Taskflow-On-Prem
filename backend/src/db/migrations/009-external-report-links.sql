BEGIN;

ALTER TABLE issue_attachments
    ADD COLUMN IF NOT EXISTS external_url VARCHAR(2048),
    ADD COLUMN IF NOT EXISTS provider VARCHAR(80),
    ALTER COLUMN file_size DROP NOT NULL,
    ALTER COLUMN file_data DROP NOT NULL;

ALTER TABLE issue_attachments
    DROP CONSTRAINT IF EXISTS issue_attachments_size_matches_data,
    DROP CONSTRAINT IF EXISTS issue_attachments_exactly_one_source;

ALTER TABLE issue_attachments
    ADD CONSTRAINT issue_attachments_size_matches_data
        CHECK (file_data IS NULL OR octet_length(file_data) = file_size),
    ADD CONSTRAINT issue_attachments_exactly_one_source
        CHECK (
            (external_url IS NOT NULL AND file_data IS NULL AND file_size IS NULL)
            OR (external_url IS NULL AND file_data IS NOT NULL AND file_size IS NOT NULL)
        );

COMMIT;
