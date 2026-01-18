DROP INDEX IF EXISTS idx_documents_expires_at;
DROP INDEX IF EXISTS idx_documents_share_token;
DROP INDEX IF EXISTS idx_documents_user_id;

ALTER TABLE documents DROP COLUMN IF EXISTS expires_at;
ALTER TABLE documents DROP COLUMN IF EXISTS share_token;
ALTER TABLE documents DROP COLUMN IF EXISTS visibility;
ALTER TABLE documents DROP COLUMN IF EXISTS user_id;
