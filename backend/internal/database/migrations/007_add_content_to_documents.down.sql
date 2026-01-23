-- Revert content column addition
DROP INDEX IF EXISTS idx_documents_has_content;
ALTER TABLE documents DROP COLUMN IF EXISTS content;
