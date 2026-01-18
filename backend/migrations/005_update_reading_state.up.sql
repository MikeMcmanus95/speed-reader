-- Add user_id to reading_state and change primary key to composite
-- First, drop the existing primary key
ALTER TABLE reading_state DROP CONSTRAINT reading_state_pkey;

-- Add user_id column
ALTER TABLE reading_state ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Create new composite primary key
ALTER TABLE reading_state ADD PRIMARY KEY (user_id, doc_id);

-- Add index for user queries
CREATE INDEX idx_reading_state_user_id ON reading_state(user_id);
