-- Cache Cleanup System
-- This file creates an automated cache cleanup system with functions and triggers

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cache_retention_days INTEGER := 7; -- Default 7 days retention
    max_entries_per_user INTEGER := 100; -- Max entries per user
BEGIN
    -- Delete entries older than retention period
    DELETE FROM event_cache 
    WHERE created_at < NOW() - INTERVAL '1 day' * cache_retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Keep only the most recent entries per user (if exceeding max_entries_per_user)
    WITH ranked_cache AS (
        SELECT id, 
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM event_cache
    )
    DELETE FROM event_cache 
    WHERE id IN (
        SELECT id FROM ranked_cache WHERE rn > max_entries_per_user
    );
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Log cleanup operation
    INSERT INTO cache_cleanup_logs (deleted_entries, cleanup_type, executed_at)
    VALUES (deleted_count, 'scheduled', NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean cache entries for a specific user
CREATE OR REPLACE FUNCTION cleanup_user_cache(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM event_cache WHERE user_id = target_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup operation
    INSERT INTO cache_cleanup_logs (deleted_entries, cleanup_type, user_id, executed_at)
    VALUES (deleted_count, 'user_specific', target_user_id, NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS TABLE (
    total_entries BIGINT,
    total_users BIGINT,
    avg_entries_per_user NUMERIC,
    oldest_entry TIMESTAMP WITH TIME ZONE,
    newest_entry TIMESTAMP WITH TIME ZONE,
    total_size_mb NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_entries,
        COUNT(DISTINCT user_id) as total_users,
        ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT user_id), 0), 2) as avg_entries_per_user,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry,
        ROUND(pg_total_relation_size('event_cache')::NUMERIC / 1024 / 1024, 2) as total_size_mb
    FROM event_cache;
END;
$$ LANGUAGE plpgsql;

-- Function to optimize cache performance
CREATE OR REPLACE FUNCTION optimize_cache_performance()
RETURNS TEXT AS $$
DECLARE
    result_message TEXT;
BEGIN
    -- Analyze table for better query planning
    ANALYZE event_cache;
    
    -- Reindex if needed (only if table is large)
    IF (SELECT COUNT(*) FROM event_cache) > 10000 THEN
        REINDEX TABLE event_cache;
        result_message := 'Cache table analyzed and reindexed';
    ELSE
        result_message := 'Cache table analyzed';
    END IF;
    
    -- Log optimization
    INSERT INTO cache_cleanup_logs (deleted_entries, cleanup_type, executed_at, notes)
    VALUES (0, 'optimization', NOW(), result_message);
    
    RETURN result_message;
END;
$$ LANGUAGE plpgsql;

-- Create cache cleanup logs table
CREATE TABLE IF NOT EXISTS cache_cleanup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deleted_entries INTEGER DEFAULT 0,
    cleanup_type VARCHAR(50) NOT NULL, -- 'scheduled', 'user_specific', 'manual', 'optimization'
    user_id UUID REFERENCES profiles(id),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    notes TEXT
);

-- Create indexes for cleanup logs
CREATE INDEX IF NOT EXISTS idx_cache_cleanup_logs_type ON cache_cleanup_logs(cleanup_type);
CREATE INDEX IF NOT EXISTS idx_cache_cleanup_logs_executed ON cache_cleanup_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_cleanup_logs_user ON cache_cleanup_logs(user_id);

-- Enable RLS on cleanup logs
ALTER TABLE cache_cleanup_logs ENABLE ROW LEVEL SECURITY;

-- Only service role and admins can access cleanup logs
CREATE POLICY "Service role can access cleanup logs" ON cache_cleanup_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger function to automatically clean cache on insert
CREATE OR REPLACE FUNCTION auto_cleanup_cache_trigger()
RETURNS TRIGGER AS $$
DECLARE
    user_cache_count INTEGER;
    max_entries_per_user INTEGER := 50; -- Trigger cleanup at 50 entries per user
BEGIN
    -- Check if user has too many cache entries
    SELECT COUNT(*) INTO user_cache_count
    FROM event_cache 
    WHERE user_id = NEW.user_id;
    
    -- If user exceeds limit, clean old entries
    IF user_cache_count > max_entries_per_user THEN
        DELETE FROM event_cache 
        WHERE user_id = NEW.user_id 
        AND id NOT IN (
            SELECT id FROM event_cache 
            WHERE user_id = NEW.user_id 
            ORDER BY created_at DESC 
            LIMIT max_entries_per_user
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cleanup
CREATE TRIGGER auto_cleanup_user_cache
    AFTER INSERT ON event_cache
    FOR EACH ROW
    EXECUTE FUNCTION auto_cleanup_cache_trigger();

-- Function to schedule periodic cleanup (to be called by cron or scheduler)
CREATE OR REPLACE FUNCTION schedule_cache_cleanup()
RETURNS TEXT AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    deleted_count INTEGER;
    execution_time INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Run cleanup
    SELECT cleanup_old_cache_entries() INTO deleted_count;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Update the log with execution time
    UPDATE cache_cleanup_logs 
    SET execution_time_ms = execution_time
    WHERE cleanup_type = 'scheduled' 
    AND executed_at = (SELECT MAX(executed_at) FROM cache_cleanup_logs WHERE cleanup_type = 'scheduled');
    
    RETURN format('Cleanup completed: %s entries deleted in %s ms', deleted_count, execution_time);
END;
$$ LANGUAGE plpgsql;

-- Create a view for cache monitoring
CREATE OR REPLACE VIEW cache_monitoring AS
SELECT 
    u.email,
    COUNT(ec.id) as cache_entries,
    MAX(ec.created_at) as last_cache_entry,
    MIN(ec.created_at) as first_cache_entry,
    ROUND(
        EXTRACT(EPOCH FROM (MAX(ec.created_at) - MIN(ec.created_at))) / 3600, 2
    ) as cache_span_hours
FROM profiles u
LEFT JOIN event_cache ec ON u.id = ec.user_id
GROUP BY u.id, u.email
ORDER BY cache_entries DESC;

-- Create cache health check function
CREATE OR REPLACE FUNCTION cache_health_check()
RETURNS TABLE (
    metric VARCHAR(50),
    value TEXT,
    status VARCHAR(20),
    recommendation TEXT
) AS $$
DECLARE
    total_entries BIGINT;
    avg_age_hours NUMERIC;
    largest_user_cache BIGINT;
    table_size_mb NUMERIC;
BEGIN
    -- Get basic metrics
    SELECT COUNT(*) INTO total_entries FROM event_cache;
    SELECT ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600), 2) 
    INTO avg_age_hours FROM event_cache;
    SELECT MAX(cache_entries) INTO largest_user_cache FROM cache_monitoring;
    SELECT ROUND(pg_total_relation_size('event_cache')::NUMERIC / 1024 / 1024, 2) 
    INTO table_size_mb;
    
    -- Return health metrics
    RETURN QUERY VALUES
        ('Total Entries', total_entries::TEXT, 
         CASE WHEN total_entries > 10000 THEN 'WARNING' 
              WHEN total_entries > 50000 THEN 'CRITICAL' 
              ELSE 'OK' END,
         CASE WHEN total_entries > 10000 THEN 'Consider more frequent cleanup' 
              ELSE 'Cache size is healthy' END),
        
        ('Average Age (hours)', avg_age_hours::TEXT,
         CASE WHEN avg_age_hours > 168 THEN 'WARNING' -- 7 days
              WHEN avg_age_hours > 336 THEN 'CRITICAL' -- 14 days
              ELSE 'OK' END,
         CASE WHEN avg_age_hours > 168 THEN 'Entries are getting old, increase cleanup frequency'
              ELSE 'Cache age is acceptable' END),
        
        ('Largest User Cache', largest_user_cache::TEXT,
         CASE WHEN largest_user_cache > 100 THEN 'WARNING'
              WHEN largest_user_cache > 200 THEN 'CRITICAL'
              ELSE 'OK' END,
         CASE WHEN largest_user_cache > 100 THEN 'Some users have excessive cache entries'
              ELSE 'User cache distribution is healthy' END),
        
        ('Table Size (MB)', table_size_mb::TEXT,
         CASE WHEN table_size_mb > 100 THEN 'WARNING'
              WHEN table_size_mb > 500 THEN 'CRITICAL'
              ELSE 'OK' END,
         CASE WHEN table_size_mb > 100 THEN 'Consider archiving or more aggressive cleanup'
              ELSE 'Table size is manageable' END);
END;
$$ LANGUAGE plpgsql;

/*
Cache Cleanup System Features:

1. Automated Cleanup:
   - Time-based cleanup (configurable retention period)
   - User-based limits (max entries per user)
   - Trigger-based cleanup on new inserts

2. Monitoring and Logging:
   - Detailed cleanup logs with execution metrics
   - Cache statistics and health checks
   - User-specific cache monitoring

3. Performance Optimization:
   - Automatic table analysis and reindexing
   - Efficient cleanup queries using CTEs
   - Minimal impact on application performance

4. Flexible Configuration:
   - Configurable retention periods
   - Adjustable user limits
   - Multiple cleanup strategies

5. Administrative Tools:
   - Manual cleanup functions
   - Health check reports
   - Performance monitoring views

Usage:
- Call schedule_cache_cleanup() periodically (e.g., daily cron job)
- Use cache_health_check() for monitoring
- Call cleanup_user_cache(user_id) for user-specific cleanup
- Monitor via cache_monitoring view
*/