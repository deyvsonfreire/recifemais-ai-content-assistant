-- Add metadata column to error_logs table
ALTER TABLE error_logs ADD COLUMN metadata jsonb;

-- Add comment to the column
COMMENT ON COLUMN error_logs.metadata IS 'Additional metadata for error context';