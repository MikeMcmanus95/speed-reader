DROP INDEX IF EXISTS idx_reading_state_user_id;

ALTER TABLE reading_state DROP CONSTRAINT reading_state_pkey;
ALTER TABLE reading_state DROP COLUMN IF EXISTS user_id;
ALTER TABLE reading_state ADD PRIMARY KEY (doc_id);
