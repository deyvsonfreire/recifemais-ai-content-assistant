-- Usage Analytics and Logging System
-- This file creates comprehensive usage tracking for monitoring and analytics

-- Main usage logs table
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    session_id UUID, -- For tracking user sessions
    action_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'generate_content', 'search_events', etc.
    action_category VARCHAR(30) NOT NULL, -- 'auth', 'content', 'search', 'admin', 'api'
    resource_type VARCHAR(50), -- 'article', 'historia', 'organizador', 'event', etc.
    resource_id UUID, -- ID of the resource being acted upon
    metadata JSONB DEFAULT '{}', -- Additional context data
    user_agent TEXT,
    ip_address INET,
    request_duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ai_model_used VARCHAR(50), -- 'gemini-pro', 'gpt-4', etc.
    tokens_consumed INTEGER,
    cost_estimate DECIMAL(10,6),
    rate_limit_hit BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature usage statistics table
CREATE TABLE IF NOT EXISTS feature_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_time_spent_ms BIGINT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.00, -- Percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, feature_name)
);

-- User session tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    actions_count INTEGER DEFAULT 0,
    pages_visited TEXT[] DEFAULT '{}',
    device_info JSONB DEFAULT '{}',
    location_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6),
    metric_unit VARCHAR(20), -- 'ms', 'bytes', 'count', 'percentage'
    context JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error tracking table
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT,
    stack_trace TEXT,
    context JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action_type ON usage_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action_category ON usage_logs(action_category);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_session_id ON usage_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_success ON usage_logs(success);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_status_code ON api_usage_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_ai_model ON api_usage_logs(ai_model_used);

CREATE INDEX IF NOT EXISTS idx_feature_usage_stats_user_id ON feature_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_stats_feature ON feature_usage_stats(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_usage_stats_last_used ON feature_usage_stats(last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_start ON user_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded ON performance_metrics(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);

-- Enable RLS on all analytics tables
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics tables
-- Users can only see their own usage data
CREATE POLICY "Users can view own usage logs" ON usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own API usage" ON api_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feature stats" ON feature_usage_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can access all analytics data
CREATE POLICY "Service role can access all usage logs" ON usage_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all API usage" ON api_usage_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all feature stats" ON feature_usage_stats
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access all sessions" ON user_sessions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access performance metrics" ON performance_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access error logs" ON error_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Function to log user actions
CREATE OR REPLACE FUNCTION log_user_action(
    p_user_id UUID,
    p_session_id UUID,
    p_action_type VARCHAR(50),
    p_action_category VARCHAR(30),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_duration_ms INTEGER DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO usage_logs (
        user_id, session_id, action_type, action_category,
        resource_type, resource_id, metadata, user_agent,
        ip_address, request_duration_ms, success, error_message
    ) VALUES (
        p_user_id, p_session_id, p_action_type, p_action_category,
        p_resource_type, p_resource_id, p_metadata, p_user_agent,
        p_ip_address, p_duration_ms, p_success, p_error_message
    ) RETURNING id INTO log_id;
    
    -- Update session activity
    UPDATE user_sessions 
    SET actions_count = actions_count + 1,
        session_end = NOW()
    WHERE id = p_session_id AND is_active = true;
    
    -- Update feature usage statistics
    INSERT INTO feature_usage_stats (user_id, feature_name, usage_count, last_used_at, first_used_at)
    VALUES (p_user_id, p_action_type, 1, NOW(), NOW())
    ON CONFLICT (user_id, feature_name) DO UPDATE SET
        usage_count = feature_usage_stats.usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW();
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start a user session
CREATE OR REPLACE FUNCTION start_user_session(
    p_user_id UUID,
    p_device_info JSONB DEFAULT '{}',
    p_location_info JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
BEGIN
    -- End any existing active sessions for this user
    UPDATE user_sessions 
    SET is_active = false,
        session_end = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - session_start)) / 60
    WHERE user_id = p_user_id AND is_active = true;
    
    -- Create new session
    INSERT INTO user_sessions (user_id, device_info, location_info)
    VALUES (p_user_id, p_device_info, p_location_info)
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end a user session
CREATE OR REPLACE FUNCTION end_user_session(p_session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_sessions 
    SET is_active = false,
        session_end = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - session_start)) / 60
    WHERE id = p_session_id AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log API usage
CREATE OR REPLACE FUNCTION log_api_usage(
    p_user_id UUID,
    p_endpoint VARCHAR(200),
    p_method VARCHAR(10),
    p_status_code INTEGER,
    p_response_time_ms INTEGER,
    p_request_size_bytes INTEGER DEFAULT NULL,
    p_response_size_bytes INTEGER DEFAULT NULL,
    p_ai_model_used VARCHAR(50) DEFAULT NULL,
    p_tokens_consumed INTEGER DEFAULT NULL,
    p_cost_estimate DECIMAL(10,6) DEFAULT NULL,
    p_rate_limit_hit BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO api_usage_logs (
        user_id, endpoint, method, status_code, response_time_ms,
        request_size_bytes, response_size_bytes, ai_model_used,
        tokens_consumed, cost_estimate, rate_limit_hit
    ) VALUES (
        p_user_id, p_endpoint, p_method, p_status_code, p_response_time_ms,
        p_request_size_bytes, p_response_size_bytes, p_ai_model_used,
        p_tokens_consumed, p_cost_estimate, p_rate_limit_hit
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
    p_metric_name VARCHAR(100),
    p_metric_value DECIMAL(15,6),
    p_metric_unit VARCHAR(20) DEFAULT NULL,
    p_context JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, context)
    VALUES (p_metric_name, p_metric_value, p_metric_unit, p_context)
    RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log errors
CREATE OR REPLACE FUNCTION log_error(
    p_user_id UUID,
    p_error_type VARCHAR(100),
    p_error_message TEXT,
    p_stack_trace TEXT DEFAULT NULL,
    p_context JSONB DEFAULT '{}',
    p_severity VARCHAR(20) DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
    error_id UUID;
BEGIN
    INSERT INTO error_logs (user_id, error_type, error_message, stack_trace, context, severity)
    VALUES (p_user_id, p_error_type, p_error_message, p_stack_trace, p_context, p_severity)
    RETURNING id INTO error_id;
    
    RETURN error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update feature usage statistics
CREATE OR REPLACE FUNCTION update_feature_usage_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Update success rate based on the success field
    UPDATE feature_usage_stats 
    SET success_rate = (
        SELECT ROUND(
            (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)) * 100, 2
        )
        FROM usage_logs 
        WHERE user_id = NEW.user_id 
        AND action_type = NEW.action_type
    )
    WHERE user_id = NEW.user_id AND feature_name = NEW.action_type;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_usage_stats
    AFTER INSERT ON usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_feature_usage_trigger();

-- Create updated_at trigger for feature_usage_stats
CREATE TRIGGER update_feature_usage_stats_updated_at 
    BEFORE UPDATE ON feature_usage_stats
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

/*
Usage Analytics System Features:

1. Comprehensive Logging:
   - User actions and behaviors
   - API usage and performance
   - Feature adoption and success rates
   - Error tracking and monitoring

2. Session Management:
   - User session tracking
   - Activity monitoring
   - Device and location info

3. Performance Monitoring:
   - Response times and metrics
   - Resource usage tracking
   - Cost estimation for AI operations

4. Analytics Functions:
   - Easy-to-use logging functions
   - Automated statistics updates
   - Real-time metric recording

5. Security and Privacy:
   - RLS policies for data protection
   - User-scoped data access
   - Service role administrative access

6. Scalability:
   - Efficient indexing strategy
   - Partitioning-ready structure
   - Optimized for time-series queries

Usage Examples:
- SELECT log_user_action(user_id, session_id, 'generate_article', 'content');
- SELECT start_user_session(user_id, '{"device": "mobile"}');
- SELECT log_api_usage(user_id, '/api/generate', 'POST', 200, 1500);
- SELECT record_performance_metric('response_time', 250.5, 'ms');
*/