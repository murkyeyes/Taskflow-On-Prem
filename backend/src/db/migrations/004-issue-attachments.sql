BEGIN;

CREATE TABLE IF NOT EXISTS issue_attachments (
    id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id    INTEGER      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    uploaded_by INTEGER      NOT NULL REFERENCES users(id),
    file_name   VARCHAR(255) NOT NULL,
    media_type  VARCHAR(120) NOT NULL,
    file_size   INTEGER      NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
    file_data   BYTEA        NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT issue_attachments_size_matches_data CHECK (octet_length(file_data) = file_size)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'issue_attachments_size_matches_data'
    ) THEN
        ALTER TABLE issue_attachments
            ADD CONSTRAINT issue_attachments_size_matches_data
            CHECK (octet_length(file_data) = file_size);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue_created
    ON issue_attachments(issue_id, created_at DESC);

COMMIT;
