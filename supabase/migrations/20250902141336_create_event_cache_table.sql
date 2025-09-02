-- Create event_cache table
-- This table stores cached event search results for performance optimization

CREATE TABLE IF NOT EXISTS event_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Will be linked to profiles(id) after profiles table is created
    search_query TEXT NOT NULL,
    cached_data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(100),
    cache_hit_count INTEGER DEFAULT 0,
    data_size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_cache_user_id ON event_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_event_cache_created_at ON event_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_cache_user_created ON event_cache(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_cache_expires_at ON event_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_event_cache_search_query ON event_cache(search_query);

-- Enable Row Level Security
ALTER TABLE event_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view own cache" ON event_cache;
CREATE POLICY "Users can view own cache" ON event_cache
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cache" ON event_cache;
CREATE POLICY "Users can insert own cache" ON event_cache
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cache" ON event_cache;
CREATE POLICY "Users can update own cache" ON event_cache
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cache" ON event_cache;
CREATE POLICY "Users can delete own cache" ON event_cache
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_event_cache_updated_at
    BEFORE UPDATE ON event_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create error_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Will be linked to profiles(id) after profiles table is created
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    url TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for error_logs
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);

-- Enable RLS for error_logs
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for error_logs
DROP POLICY IF EXISTS "Users can view own errors" ON error_logs;
CREATE POLICY "Users can view own errors" ON error_logs
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert errors" ON error_logs;
CREATE POLICY "Users can insert errors" ON error_logs
    FOR INSERT WITH CHECK (true); -- Allow all users to insert error logs