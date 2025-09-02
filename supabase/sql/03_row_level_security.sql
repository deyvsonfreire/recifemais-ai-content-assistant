-- Row Level Security (RLS) Configuration
-- This file configures RLS policies to protect user data and ensure proper access control

-- Enable RLS on all user-related tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles table policies
-- Users can only view and update their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Event cache policies
-- Users can only access their own cached events
CREATE POLICY "Users can view own event cache" ON event_cache
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own event cache" ON event_cache
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own event cache" ON event_cache
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own event cache" ON event_cache
    FOR DELETE USING (auth.uid() = user_id);

-- Processed events policies
-- Users can only access their own processed events
CREATE POLICY "Users can view own processed events" ON processed_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processed events" ON processed_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processed events" ON processed_events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own processed events" ON processed_events
    FOR DELETE USING (auth.uid() = user_id);

-- User preferences policies
-- Users can only access their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Scraped events policies
-- All authenticated users can read scraped events (public data)
-- Only service role can insert/update/delete
ALTER TABLE scraped_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scraped events" ON scraped_events
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage scraped events" ON scraped_events
    FOR ALL USING (auth.role() = 'service_role');

-- Event sources policies (admin/service only)
ALTER TABLE event_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event sources" ON event_sources
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage event sources" ON event_sources
    FOR ALL USING (auth.role() = 'service_role');

-- Event categories policies (read-only for users)
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event categories" ON event_categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage event categories" ON event_categories
    FOR ALL USING (auth.role() = 'service_role');

-- Event tags policies
ALTER TABLE event_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event tags" ON event_tags
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage event tags" ON event_tags
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view event tag relations" ON scraped_event_tags
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage event tag relations" ON scraped_event_tags
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to check if user is admin (for future use)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user has admin role in profiles table
    -- This assumes you'll add a role column to profiles
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = user_id 
        AND (role = 'admin' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user owns a scraped event (through processing)
CREATE OR REPLACE FUNCTION user_owns_scraped_event(event_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user has processed this event
    RETURN EXISTS (
        SELECT 1 FROM processed_events 
        WHERE scraped_event_id = event_id 
        AND processed_events.user_id = user_owns_scraped_event.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advanced RLS policy for scraped events based on user interaction
-- Users can view events they've interacted with (processed)
CREATE POLICY "Users can view events they've processed" ON scraped_events
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            -- Event is public (default)
            true
            -- OR user has processed this event
            OR user_owns_scraped_event(id, auth.uid())
        )
    );

-- Create audit log function for sensitive operations
CREATE OR REPLACE FUNCTION audit_sensitive_operations()
RETURNS TRIGGER AS $$
BEGIN
    -- Log sensitive operations (updates to profiles, deletions, etc.)
    INSERT INTO audit_logs (table_name, operation, user_id, old_data, new_data, timestamp)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        NOW()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit logs table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id UUID,
    old_data JSONB,
    new_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access audit logs
CREATE POLICY "Service role can access audit logs" ON audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Create audit triggers for sensitive tables
CREATE TRIGGER audit_profiles_changes
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_operations();

CREATE TRIGGER audit_user_preferences_changes
    AFTER INSERT OR UPDATE OR DELETE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_operations();

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

/*
RLS Security Strategy:

1. User Data Isolation:
   - Each user can only access their own data
   - Profiles, preferences, cache, and processed events are user-scoped
   - Uses auth.uid() to enforce ownership

2. Public Data Access:
   - Scraped events are readable by all authenticated users
   - Event sources, categories, and tags are read-only for users
   - Only service role can modify public data

3. Administrative Functions:
   - Service role has full access to all tables
   - Admin functions are prepared for future role-based access
   - Audit logging for sensitive operations

4. Security Features:
   - All policies use SECURITY DEFINER for functions
   - Audit trail for data changes
   - Granular permissions per operation type

5. Performance Considerations:
   - Policies are optimized to use indexes
   - Functions are marked as SECURITY DEFINER
   - Minimal overhead for common operations
*/