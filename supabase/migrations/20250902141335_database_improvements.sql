-- Database Improvements for RecifeMais AI Content Assistant
-- This migration adds normalized tables, RLS, and analytics
-- Note: scraped_events table and its indexes are created in the previous migration

-- Performance Indexes for other tables
DO $$
BEGIN
    -- Additional indexes for scraped_events (complementing the base ones)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scraped_events') THEN
        -- Text search indexes if raw_title and raw_description exist
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_events' AND column_name = 'raw_title') THEN
            CREATE INDEX IF NOT EXISTS idx_scraped_events_raw_title_search ON scraped_events USING gin(to_tsvector('portuguese', raw_title));
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_events' AND column_name = 'raw_description') THEN
            CREATE INDEX IF NOT EXISTS idx_scraped_events_raw_description_search ON scraped_events USING gin(to_tsvector('portuguese', COALESCE(raw_description, '')));
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scraped_events' AND column_name = 'description') THEN
            CREATE INDEX IF NOT EXISTS idx_scraped_events_description_search ON scraped_events USING gin(to_tsvector('portuguese', description));
        END IF;
    END IF;
    
    -- Indexes for event_cache table (if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_cache') THEN
        CREATE INDEX IF NOT EXISTS idx_event_cache_user_id ON event_cache(user_id);
        CREATE INDEX IF NOT EXISTS idx_event_cache_created_at ON event_cache(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_event_cache_user_created ON event_cache(user_id, created_at DESC);
        
        -- GIN index for search_params if it exists and is JSONB
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_cache' AND column_name = 'search_params' 
                   AND data_type = 'jsonb') THEN
            CREATE INDEX IF NOT EXISTS idx_event_cache_search_params ON event_cache USING gin(search_params);
        END IF;
    END IF;
    
    -- Indexes for profiles table (if it exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'email') THEN
            CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
            CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC);
        END IF;
    END IF;
END $$;

-- Normalized Tables
-- Event sources lookup table
CREATE TABLE IF NOT EXISTS event_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    base_url VARCHAR(500),
    api_endpoint VARCHAR(500),
    rate_limit_per_hour INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event categories lookup table
CREATE TABLE IF NOT EXISTS event_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES event_categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processed events table with normalized structure
CREATE TABLE IF NOT EXISTS processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INTEGER REFERENCES event_sources(id),
    category_id INTEGER REFERENCES event_categories(id),
    original_event_id VARCHAR(255), -- ID from the source system
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    location_name VARCHAR(300),
    location_address TEXT,
    location_coordinates POINT,
    price_min DECIMAL(10,2),
    price_max DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'BRL',
    organizer_name VARCHAR(200),
    organizer_contact JSONB,
    event_url VARCHAR(1000),
    image_url VARCHAR(1000),
    tags TEXT[],
    metadata JSONB,
    processing_status VARCHAR(50) DEFAULT 'pending',
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_by UUID -- Will be linked to profiles(id) after profiles table is created
);

-- Indexes for normalized tables
CREATE INDEX IF NOT EXISTS idx_processed_events_source ON processed_events(source_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_category ON processed_events(category_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_date ON processed_events(event_date);
CREATE INDEX IF NOT EXISTS idx_processed_events_location ON processed_events USING gist(location_coordinates);
CREATE INDEX IF NOT EXISTS idx_processed_events_status ON processed_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_events_quality ON processed_events(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_processed_events_tags ON processed_events USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_processed_events_metadata ON processed_events USING gin(metadata);

-- Row Level Security (RLS)
-- Enable RLS on user-specific tables
-- Note: RLS for event_cache is enabled in the event_cache table migration
-- Note: RLS for profiles is enabled in the profiles table migration
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: Event cache policies are created in the event_cache table migration
-- Note: Profiles policies are created in the profiles table migration

-- Processed events: users can view all, but only update their own processed events
DROP POLICY IF EXISTS "Users can view all processed events" ON processed_events;
CREATE POLICY "Users can view all processed events" ON processed_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert processed events" ON processed_events;
CREATE POLICY "Users can insert processed events" ON processed_events
    FOR INSERT WITH CHECK (auth.uid() = processed_by);

DROP POLICY IF EXISTS "Users can update own processed events" ON processed_events;
CREATE POLICY "Users can update own processed events" ON processed_events
    FOR UPDATE USING (auth.uid() = processed_by);

-- Cache Cleanup System
-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_cache(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete cache entries older than retention_days
    DELETE FROM event_cache 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO cache_cleanup_log (deleted_count, retention_days, cleaned_at)
    VALUES (deleted_count, retention_days, NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cache cleanup log table
CREATE TABLE IF NOT EXISTS cache_cleanup_log (
    id SERIAL PRIMARY KEY,
    deleted_count INTEGER NOT NULL,
    retention_days INTEGER NOT NULL,
    cleaned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to relevant tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_sources') THEN
        DROP TRIGGER IF EXISTS update_event_sources_updated_at ON event_sources;
        CREATE TRIGGER update_event_sources_updated_at
            BEFORE UPDATE ON event_sources
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processed_events') THEN
        DROP TRIGGER IF EXISTS update_processed_events_updated_at ON processed_events;
        CREATE TRIGGER update_processed_events_updated_at
            BEFORE UPDATE ON processed_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Usage Analytics Tables
-- User action logs
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Will be linked to profiles(id) after profiles table is created
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage logs
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Will be linked to profiles(id) after profiles table is created
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ai_tokens_used INTEGER,
    ai_model_used VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature usage statistics
CREATE TABLE IF NOT EXISTS feature_usage_stats (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    unique_users_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    date_recorded DATE DEFAULT CURRENT_DATE,
    UNIQUE(feature_name, date_recorded)
);

-- User sessions tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Will be linked to profiles(id) after profiles table is created
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    pages_visited INTEGER DEFAULT 0,
    actions_performed INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6),
    metric_unit VARCHAR(20),
    tags JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error logs
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Will be linked to profiles(id) after profiles table is created
    error_type VARCHAR(100),
    error_message TEXT,
    stack_trace TEXT,
    request_url VARCHAR(1000),
    request_method VARCHAR(10),
    request_body TEXT,
    severity VARCHAR(20) DEFAULT 'error',
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_start ON user_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);

-- Enable RLS for analytics tables
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics (users see only their own data, service_role sees all)
CREATE POLICY "Users can view own usage logs" ON usage_logs
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view own API usage" ON api_usage_logs
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view own errors" ON error_logs
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- Service role can insert into all analytics tables
CREATE POLICY "Service role can insert usage logs" ON usage_logs
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can insert API usage" ON api_usage_logs
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage sessions" ON user_sessions
    FOR ALL WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can insert errors" ON error_logs
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Analytics functions
CREATE OR REPLACE FUNCTION log_user_action(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id VARCHAR(255) DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO usage_logs (user_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
    VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_metadata, p_ip_address, p_user_agent)
    RETURNING id INTO log_id;
    
    -- Update feature usage stats
    INSERT INTO feature_usage_stats (feature_name, usage_count, unique_users_count, last_used_at, date_recorded)
    VALUES (p_action, 1, 1, NOW(), CURRENT_DATE)
    ON CONFLICT (feature_name, date_recorded)
    DO UPDATE SET 
        usage_count = feature_usage_stats.usage_count + 1,
        last_used_at = NOW();
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start a user session
CREATE OR REPLACE FUNCTION start_user_session(
    p_user_id UUID,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
BEGIN
    INSERT INTO user_sessions (user_id, ip_address, user_agent)
    VALUES (p_user_id, p_ip_address, p_user_agent)
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a user session
CREATE OR REPLACE FUNCTION end_user_session(
    p_session_id UUID,
    p_pages_visited INTEGER DEFAULT 0,
    p_actions_performed INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_sessions 
    SET 
        session_end = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - session_start)) / 60,
        pages_visited = p_pages_visited,
        actions_performed = p_actions_performed
    WHERE id = p_session_id AND session_end IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Materialized Views for Analytics
-- Daily user activity summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
SELECT 
    DATE(created_at) as activity_date,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_actions,
    COUNT(DISTINCT action) as unique_actions
FROM usage_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_summary_date 
ON mv_user_activity_summary(activity_date);

-- Daily usage statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_usage_stats AS
SELECT 
    DATE(created_at) as usage_date,
    COUNT(*) as total_requests,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(response_time_ms) as avg_response_time,
    SUM(ai_tokens_used) as total_ai_tokens,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
FROM api_usage_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY usage_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_usage_stats_date 
ON mv_daily_usage_stats(usage_date);

-- Feature popularity analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_feature_popularity AS
SELECT 
    feature_name,
    SUM(usage_count) as total_usage,
    COUNT(DISTINCT date_recorded) as days_used,
    MAX(last_used_at) as last_used,
    AVG(usage_count) as avg_daily_usage
FROM feature_usage_stats 
WHERE date_recorded >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY feature_name
ORDER BY total_usage DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_feature_popularity_name 
ON mv_feature_popularity(feature_name);

-- Content analytics (events processing)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_content_analytics AS
SELECT 
    DATE(created_at) as processing_date,
    processing_status,
    COUNT(*) as event_count,
    AVG(quality_score) as avg_quality_score,
    COUNT(DISTINCT source_id) as unique_sources,
    COUNT(DISTINCT category_id) as unique_categories
FROM processed_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), processing_status
ORDER BY processing_date DESC, processing_status;

CREATE INDEX IF NOT EXISTS idx_mv_content_analytics_date_status 
ON mv_content_analytics(processing_date, processing_status);

-- Error analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_error_analysis AS
SELECT 
    DATE(created_at) as error_date,
    error_type,
    severity,
    COUNT(*) as error_count,
    COUNT(DISTINCT user_id) as affected_users,
    COUNT(CASE WHEN resolved = true THEN 1 END) as resolved_count
FROM error_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), error_type, severity
ORDER BY error_date DESC, error_count DESC;

CREATE INDEX IF NOT EXISTS idx_mv_error_analysis_date_type 
ON mv_error_analysis(error_date, error_type);

-- Performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_performance_summary AS
SELECT 
    DATE(recorded_at) as metric_date,
    metric_name,
    metric_unit,
    AVG(metric_value) as avg_value,
    MIN(metric_value) as min_value,
    MAX(metric_value) as max_value,
    COUNT(*) as measurement_count
FROM performance_metrics 
WHERE recorded_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(recorded_at), metric_name, metric_unit
ORDER BY metric_date DESC, metric_name;

CREATE INDEX IF NOT EXISTS idx_mv_performance_summary_date_name 
ON mv_performance_summary(metric_date, metric_name);

-- Functions to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS BOOLEAN AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_usage_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_feature_popularity;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_content_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_error_analysis;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backup and Migration System
-- Schema version tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by UUID, -- Will be linked to profiles(id) after profiles table is created
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    rollback_sql TEXT,
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed'))
);

-- Database backup logs table
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(50) NOT NULL,
    backup_size_bytes BIGINT,
    backup_location VARCHAR(1000),
    backup_status VARCHAR(20) DEFAULT 'in_progress',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retention_until TIMESTAMP WITH TIME ZONE
);

-- Schema snapshots table
CREATE TABLE IF NOT EXISTS schema_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_name VARCHAR(200) NOT NULL,
    schema_definition TEXT NOT NULL,
    table_count INTEGER,
    function_count INTEGER,
    index_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID -- Will be linked to profiles(id) after profiles table is created
);

-- Data integrity check logs
CREATE TABLE IF NOT EXISTS integrity_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    issues_found INTEGER DEFAULT 0,
    issues_details JSONB,
    check_status VARCHAR(20) DEFAULT 'completed',
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    performed_by UUID -- Will be linked to profiles(id) after profiles table is created
);

-- Indexes for backup and migration tables
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_started_at ON backup_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(backup_status);
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_created_at ON schema_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_check_logs_performed_at ON integrity_check_logs(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_check_logs_table ON integrity_check_logs(table_name);

-- Enable RLS for backup and migration tables (only service_role access)
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_check_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (service_role only)
CREATE POLICY "Service role only access" ON schema_migrations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role only access" ON backup_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role only access" ON schema_snapshots
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role only access" ON integrity_check_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert initial migration record
INSERT INTO schema_migrations (version, name, applied_by, status)
VALUES ('20250902141335', 'database_improvements', NULL, 'applied')
ON CONFLICT (version) DO NOTHING;

-- Create initial schema snapshot
DO $$
DECLARE
    schema_def TEXT;
    table_cnt INTEGER;
    func_cnt INTEGER;
    idx_cnt INTEGER;
BEGIN
    -- Get basic schema information
    SELECT COUNT(*) INTO table_cnt FROM information_schema.tables WHERE table_schema = 'public';
    SELECT COUNT(*) INTO func_cnt FROM information_schema.routines WHERE routine_schema = 'public';
    SELECT COUNT(*) INTO idx_cnt FROM pg_indexes WHERE schemaname = 'public';
    
    schema_def := 'Database improvements applied: ' || NOW()::TEXT;
    
    INSERT INTO schema_snapshots (snapshot_name, schema_definition, table_count, function_count, index_count)
    VALUES ('baseline_after_improvements', schema_def, table_cnt, func_cnt, idx_cnt);
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database improvements successfully applied!';
    RAISE NOTICE 'Created tables: event_sources, event_categories, processed_events';
    RAISE NOTICE 'Analytics tables: usage_logs, api_usage_logs, feature_usage_stats, user_sessions, performance_metrics, error_logs';
    RAISE NOTICE 'Backup tables: schema_migrations, backup_logs, schema_snapshots, integrity_check_logs';
    RAISE NOTICE 'Materialized views: mv_user_activity_summary, mv_daily_usage_stats, mv_feature_popularity, mv_content_analytics, mv_error_analysis, mv_performance_summary';
    RAISE NOTICE 'Performance indexes and RLS policies applied';
END $$;