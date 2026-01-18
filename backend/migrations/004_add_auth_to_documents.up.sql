-- Add user ownership and sharing to documents
ALTER TABLE documents ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'));
ALTER TABLE documents ADD COLUMN share_token UUID UNIQUE;
ALTER TABLE documents ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for auth queries
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_share_token ON documents(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_documents_expires_at ON documents(expires_at) WHERE expires_at IS NOT NULL;

-- Note: user_id is nullable initially to allow for migration of existing data
-- In practice, all new documents will have user_id set
