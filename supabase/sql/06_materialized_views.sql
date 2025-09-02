-- Materialized Views for Reports and Complex Queries
-- This file creates materialized views for improved performance on analytical queries

-- User activity summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
SELECT 
    p.id as user_id,
    p.email,
    p.created_at as user_created_at,
    COUNT(DISTINCT us.id) as total_sessions,
    COUNT(DISTINCT DATE(us.session_start)) as active_days,
    COALESCE(AVG(us.duration_minutes), 0) as avg_session_duration,
    COUNT(ul.id) as total_actions,
    COUNT(DISTINCT ul.action_type) as unique_actions,
    COUNT(pe.id) as content_generated,
    COUNT(ec.id) as cache_entries,
    MAX(ul.created_at) as last_activity,
    CASE 
        WHEN MAX(ul.created_at) > NOW() - INTERVAL '7 days' THEN 'active'
        WHEN MAX(ul.created_at) > NOW() - INTERVAL '30 days' THEN 'inactive'
        ELSE 'dormant'
    END as user_status
FROM profiles p
LEFT JOIN user_sessions us ON p.id = us.user_id
LEFT JOIN usage_logs ul ON p.id = ul.user_id
LEFT JOIN processed_events pe ON p.id = pe.user_id
LEFT JOIN event_cache ec ON p.id = ec.user_id
GROUP BY p.id, p.email, p.created_at;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_user_activity_summary_user_id 
ON mv_user_activity_summary(user_id);

-- Daily usage statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_usage_stats AS
SELECT 
    DATE(ul.created_at) as usage_date,
    COUNT(DISTINCT ul.user_id) as unique_users,
    COUNT(ul.id) as total_actions,
    COUNT(DISTINCT ul.session_id) as total_sessions,
    COUNT(ul.id) FILTER (WHERE ul.action_category = 'content') as content_actions,
    COUNT(ul.id) FILTER (WHERE ul.action_category = 'search') as search_actions,
    COUNT(ul.id) FILTER (WHERE ul.action_category = 'auth') as auth_actions,
    COUNT(ul.id) FILTER (WHERE ul.success = false) as failed_actions,
    ROUND(AVG(ul.request_duration_ms), 2) as avg_response_time,
    COUNT(pe.id) as content_generated,
    COALESCE(SUM(aul.tokens_consumed), 0) as total_tokens_used,
    COALESCE(SUM(aul.cost_estimate), 0) as total_cost
FROM usage_logs ul
LEFT JOIN processed_events pe ON DATE(ul.created_at) = DATE(pe.created_at)
LEFT JOIN api_usage_logs aul ON DATE(ul.created_at) = DATE(aul.created_at)
GROUP BY DATE(ul.created_at)
ORDER BY usage_date DESC;

-- Create unique index for daily stats
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_usage_stats_date 
ON mv_daily_usage_stats(usage_date);

-- Feature popularity materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_feature_popularity AS
SELECT 
    fus.feature_name,
    COUNT(DISTINCT fus.user_id) as unique_users,
    SUM(fus.usage_count) as total_usage,
    ROUND(AVG(fus.usage_count), 2) as avg_usage_per_user,
    ROUND(AVG(fus.success_rate), 2) as avg_success_rate,
    MAX(fus.last_used_at) as last_used,
    COUNT(fus.user_id) FILTER (WHERE fus.last_used_at > NOW() - INTERVAL '7 days') as active_users_7d,
    COUNT(fus.user_id) FILTER (WHERE fus.last_used_at > NOW() - INTERVAL '30 days') as active_users_30d,
    ROUND(
        (COUNT(fus.user_id) FILTER (WHERE fus.last_used_at > NOW() - INTERVAL '7 days')::DECIMAL / 
         NULLIF(COUNT(DISTINCT fus.user_id), 0)) * 100, 2
    ) as retention_rate_7d
FROM feature_usage_stats fus
GROUP BY fus.feature_name
ORDER BY total_usage DESC;

-- Create unique index for feature popularity
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_feature_popularity_feature 
ON mv_feature_popularity(feature_name);

-- Content generation analytics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_content_analytics AS
SELECT 
    pe.processing_type,
    pe.ai_model,
    COUNT(pe.id) as total_generations,
    COUNT(DISTINCT pe.user_id) as unique_users,
    COUNT(pe.id) FILTER (WHERE pe.processing_status = 'completed') as successful_generations,
    COUNT(pe.id) FILTER (WHERE pe.processing_status = 'failed') as failed_generations,
    ROUND(
        (COUNT(pe.id) FILTER (WHERE pe.processing_status = 'completed')::DECIMAL / 
         NULLIF(COUNT(pe.id), 0)) * 100, 2
    ) as success_rate,
    ROUND(AVG(pe.processing_time_ms), 2) as avg_processing_time,
    COALESCE(SUM(pe.tokens_used), 0) as total_tokens,
    COALESCE(SUM(pe.cost_estimate), 0) as total_cost,
    ROUND(AVG(pe.tokens_used), 2) as avg_tokens_per_generation,
    ROUND(AVG(pe.cost_estimate), 4) as avg_cost_per_generation,
    DATE_TRUNC('month', pe.created_at) as month_year
FROM processed_events pe
WHERE pe.created_at >= NOW() - INTERVAL '12 months'
GROUP BY pe.processing_type, pe.ai_model, DATE_TRUNC('month', pe.created_at)
ORDER BY month_year DESC, total_generations DESC;

-- Create index for content analytics
CREATE INDEX IF NOT EXISTS idx_mv_content_analytics_type_model_month 
ON mv_content_analytics(processing_type, ai_model, month_year);

-- Error analysis materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_error_analysis AS
SELECT 
    el.error_type,
    el.severity,
    COUNT(el.id) as error_count,
    COUNT(DISTINCT el.user_id) as affected_users,
    COUNT(el.id) FILTER (WHERE el.resolved = true) as resolved_errors,
    COUNT(el.id) FILTER (WHERE el.resolved = false) as unresolved_errors,
    ROUND(
        (COUNT(el.id) FILTER (WHERE el.resolved = true)::DECIMAL / 
         NULLIF(COUNT(el.id), 0)) * 100, 2
    ) as resolution_rate,
    MIN(el.created_at) as first_occurrence,
    MAX(el.created_at) as last_occurrence,
    DATE_TRUNC('day', el.created_at) as error_date
FROM error_logs el
WHERE el.created_at >= NOW() - INTERVAL '30 days'
GROUP BY el.error_type, el.severity, DATE_TRUNC('day', el.created_at)
ORDER BY error_date DESC, error_count DESC;

-- Create index for error analysis
CREATE INDEX IF NOT EXISTS idx_mv_error_analysis_type_severity_date 
ON mv_error_analysis(error_type, severity, error_date);

-- Performance metrics summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_performance_summary AS
SELECT 
    pm.metric_name,
    pm.metric_unit,
    COUNT(pm.id) as measurement_count,
    ROUND(AVG(pm.metric_value), 4) as avg_value,
    ROUND(MIN(pm.metric_value), 4) as min_value,
    ROUND(MAX(pm.metric_value), 4) as max_value,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.metric_value), 4) as median_value,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pm.metric_value), 4) as p95_value,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.metric_value), 4) as p99_value,
    DATE_TRUNC('hour', pm.recorded_at) as hour_bucket
FROM performance_metrics pm
WHERE pm.recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY pm.metric_name, pm.metric_unit, DATE_TRUNC('hour', pm.recorded_at)
ORDER BY hour_bucket DESC;

-- Create index for performance summary
CREATE INDEX IF NOT EXISTS idx_mv_performance_summary_name_hour 
ON mv_performance_summary(metric_name, hour_bucket);

-- Event processing pipeline analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_event_pipeline_analytics AS
SELECT 
    es.name as source_name,
    COUNT(se.id) as total_events_scraped,
    COUNT(se.id) FILTER (WHERE se.processed = true) as processed_events,
    COUNT(se.id) FILTER (WHERE se.processed = false) as unprocessed_events,
    COUNT(pe.id) as ai_processed_events,
    ROUND(
        (COUNT(se.id) FILTER (WHERE se.processed = true)::DECIMAL / 
         NULLIF(COUNT(se.id), 0)) * 100, 2
    ) as processing_rate,
    ROUND(
        (COUNT(pe.id)::DECIMAL / 
         NULLIF(COUNT(se.id) FILTER (WHERE se.processed = true), 0)) * 100, 2
    ) as ai_adoption_rate,
    DATE_TRUNC('day', se.created_at) as scrape_date
FROM scraped_events se
LEFT JOIN event_sources es ON se.source = es.name
LEFT JOIN processed_events pe ON se.id = pe.scraped_event_id
WHERE se.created_at >= NOW() - INTERVAL '30 days'
GROUP BY es.name, DATE_TRUNC('day', se.created_at)
ORDER BY scrape_date DESC, total_events_scraped DESC;

-- Create index for event pipeline analytics
CREATE INDEX IF NOT EXISTS idx_mv_event_pipeline_analytics_source_date 
ON mv_event_pipeline_analytics(source_name, scrape_date);

-- User engagement cohort analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_cohort_analysis AS
WITH user_cohorts AS (
    SELECT 
        p.id as user_id,
        DATE_TRUNC('month', p.created_at) as cohort_month,
        DATE_TRUNC('month', ul.created_at) as activity_month
    FROM profiles p
    LEFT JOIN usage_logs ul ON p.id = ul.user_id
    WHERE p.created_at >= NOW() - INTERVAL '12 months'
),
cohort_data AS (
    SELECT 
        cohort_month,
        activity_month,
        COUNT(DISTINCT user_id) as active_users,
        EXTRACT(MONTH FROM AGE(activity_month, cohort_month)) as month_number
    FROM user_cohorts
    WHERE activity_month IS NOT NULL
    GROUP BY cohort_month, activity_month
),
cohort_sizes AS (
    SELECT 
        cohort_month,
        COUNT(DISTINCT user_id) as cohort_size
    FROM user_cohorts
    GROUP BY cohort_month
)
SELECT 
    cd.cohort_month,
    cs.cohort_size,
    cd.month_number,
    cd.active_users,
    ROUND((cd.active_users::DECIMAL / cs.cohort_size) * 100, 2) as retention_rate
FROM cohort_data cd
JOIN cohort_sizes cs ON cd.cohort_month = cs.cohort_month
ORDER BY cd.cohort_month DESC, cd.month_number;

-- Create index for cohort analysis
CREATE INDEX IF NOT EXISTS idx_mv_user_cohort_analysis_cohort_month 
ON mv_user_cohort_analysis(cohort_month, month_number);

-- Functions to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS TEXT AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    refresh_log TEXT := '';
BEGIN
    start_time := clock_timestamp();
    
    -- Refresh all materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
    refresh_log := refresh_log || 'User Activity Summary refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_usage_stats;
    refresh_log := refresh_log || 'Daily Usage Stats refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_feature_popularity;
    refresh_log := refresh_log || 'Feature Popularity refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_content_analytics;
    refresh_log := refresh_log || 'Content Analytics refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_error_analysis;
    refresh_log := refresh_log || 'Error Analysis refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary;
    refresh_log := refresh_log || 'Performance Summary refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_pipeline_analytics;
    refresh_log := refresh_log || 'Event Pipeline Analytics refreshed. ';
    
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_cohort_analysis;
    refresh_log := refresh_log || 'User Cohort Analysis refreshed. ';
    
    end_time := clock_timestamp();
    
    -- Log the refresh operation
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, context)
    VALUES (
        'materialized_views_refresh_time',
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
        'ms',
        jsonb_build_object('refresh_log', refresh_log)
    );
    
    RETURN format('All materialized views refreshed in %s ms. %s', 
                  ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000, 2),
                  refresh_log);
END;
$$ LANGUAGE plpgsql;

-- Function to refresh specific materialized view
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS TEXT AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    sql_command TEXT;
BEGIN
    start_time := clock_timestamp();
    
    -- Validate view name and construct SQL
    CASE view_name
        WHEN 'user_activity_summary' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary';
        WHEN 'daily_usage_stats' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_usage_stats';
        WHEN 'feature_popularity' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_feature_popularity';
        WHEN 'content_analytics' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_content_analytics';
        WHEN 'error_analysis' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_error_analysis';
        WHEN 'performance_summary' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary';
        WHEN 'event_pipeline_analytics' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_event_pipeline_analytics';
        WHEN 'user_cohort_analysis' THEN
            sql_command := 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_cohort_analysis';
        ELSE
            RAISE EXCEPTION 'Invalid materialized view name: %', view_name;
    END CASE;
    
    -- Execute the refresh
    EXECUTE sql_command;
    
    end_time := clock_timestamp();
    
    RETURN format('Materialized view %s refreshed in %s ms', 
                  view_name,
                  ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000, 2));
END;
$$ LANGUAGE plpgsql;

/*
Materialized Views Benefits:

1. Performance Optimization:
   - Pre-computed complex aggregations
   - Faster dashboard and report queries
   - Reduced load on transactional tables

2. Analytics Ready:
   - User behavior analysis
   - Feature adoption metrics
   - Content generation insights
   - Error tracking and resolution

3. Business Intelligence:
   - Cohort analysis for user retention
   - Performance monitoring
   - Cost tracking and optimization
   - Pipeline efficiency metrics

4. Maintenance:
   - Concurrent refresh for minimal downtime
   - Selective refresh capabilities
   - Performance monitoring of refresh operations

5. Scalability:
   - Unique indexes for efficient updates
   - Time-based partitioning ready
   - Optimized for analytical workloads

Usage:
- Refresh all views: SELECT refresh_all_materialized_views();
- Refresh specific view: SELECT refresh_materialized_view('user_activity_summary');
- Schedule regular refreshes via cron or pg_cron extension
- Query views directly for fast analytics: SELECT * FROM mv_user_activity_summary;
*/