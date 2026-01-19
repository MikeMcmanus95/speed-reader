-- Add content column to store original document text for editing
-- Nullable to support existing documents that don't have stored content
ALTER TABLE documents ADD COLUMN content TEXT;

-- Index to efficiently filter documents with/without content
CREATE INDEX idx_documents_has_content ON documents ((content IS NOT NULL));
