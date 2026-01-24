-- Add settings JSONB column to users table for user preferences
ALTER TABLE users ADD COLUMN settings JSONB;

-- Comment for documentation
COMMENT ON COLUMN users.settings IS 'User preferences stored as JSONB. NULL means use application defaults.';
