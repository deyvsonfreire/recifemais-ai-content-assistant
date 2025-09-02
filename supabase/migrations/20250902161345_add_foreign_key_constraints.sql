-- Add foreign key constraints after profiles table is created

-- Add foreign key constraint for processed_events.processed_by
ALTER TABLE processed_events 
ADD CONSTRAINT fk_processed_events_processed_by 
FOREIGN KEY (processed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- Add foreign key constraints for other tables that reference profiles
-- (These may have been created in other migrations)

-- Update event_cache table to ensure it has proper foreign key
ALTER TABLE event_cache 
DROP CONSTRAINT IF EXISTS event_cache_user_id_fkey;

ALTER TABLE event_cache 
ADD CONSTRAINT fk_event_cache_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Update error_logs table to ensure it has proper foreign key
ALTER TABLE error_logs 
DROP CONSTRAINT IF EXISTS error_logs_user_id_fkey;

ALTER TABLE error_logs 
ADD CONSTRAINT fk_error_logs_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Update processed_events table for user_id if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'processed_events' AND column_name = 'user_id') THEN
        ALTER TABLE processed_events 
        DROP CONSTRAINT IF EXISTS processed_events_user_id_fkey;
        
        ALTER TABLE processed_events 
        ADD CONSTRAINT fk_processed_events_user_id 
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
END $$;