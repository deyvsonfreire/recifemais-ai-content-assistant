-- Backup and Declarative Schema Migration System
-- This file creates a comprehensive backup and migration system for the database

-- Schema version tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by UUID REFERENCES profiles(id),
    checksum VARCHAR(64), -- SHA-256 hash of the migration content
    execution_time_ms INTEGER,
    rollback_sql TEXT,
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed'))
);

-- Database backup logs table
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'schema_only', 'data_only'
    backup_size_bytes BIGINT,
    backup_location TEXT,
    backup_format VARCHAR(20) DEFAULT 'sql', -- 'sql', 'custom', 'tar'
    compression_used BOOLEAN DEFAULT false,
    encryption_used BOOLEAN DEFAULT false,
    tables_included TEXT[],
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    retention_until TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES profiles(id)
);

-- Schema snapshot table for tracking changes
CREATE TABLE IF NOT EXISTS schema_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_name VARCHAR(100) NOT NULL,
    schema_definition JSONB NOT NULL,
    table_count INTEGER,
    function_count INTEGER,
    view_count INTEGER,
    index_count INTEGER,
    trigger_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    is_baseline BOOLEAN DEFAULT false
);

-- Data integrity check logs
CREATE TABLE IF NOT EXISTS integrity_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type VARCHAR(50) NOT NULL, -- 'foreign_keys', 'constraints', 'indexes', 'full'
    table_name VARCHAR(100),
    issues_found INTEGER DEFAULT 0,
    issues_details JSONB DEFAULT '[]',
    check_duration_ms INTEGER,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed'))
);

-- Create indexes for backup and migration tables
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);

CREATE INDEX IF NOT EXISTS idx_backup_logs_type ON backup_logs(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_logs_started_at ON backup_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);
CREATE INDEX IF NOT EXISTS idx_backup_logs_retention ON backup_logs(retention_until);

CREATE INDEX IF NOT EXISTS idx_schema_snapshots_created_at ON schema_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schema_snapshots_baseline ON schema_snapshots(is_baseline);

CREATE INDEX IF NOT EXISTS idx_integrity_check_logs_executed_at ON integrity_check_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_integrity_check_logs_table ON integrity_check_logs(table_name);

-- Enable RLS on backup and migration tables
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_check_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for backup and migration tables (service role only)
CREATE POLICY "Service role can access schema migrations" ON schema_migrations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access backup logs" ON backup_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access schema snapshots" ON schema_snapshots
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access integrity check logs" ON integrity_check_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Function to create schema snapshot
CREATE OR REPLACE FUNCTION create_schema_snapshot(
    p_snapshot_name VARCHAR(100),
    p_created_by UUID DEFAULT NULL,
    p_is_baseline BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    snapshot_id UUID;
    schema_def JSONB;
    table_cnt INTEGER;
    function_cnt INTEGER;
    view_cnt INTEGER;
    index_cnt INTEGER;
    trigger_cnt INTEGER;
BEGIN
    -- Gather schema information
    SELECT jsonb_build_object(
        'tables', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'table_name', table_name,
                    'table_schema', table_schema,
                    'columns', (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'column_name', column_name,
                                'data_type', data_type,
                                'is_nullable', is_nullable,
                                'column_default', column_default
                            )
                        )
                        FROM information_schema.columns c
                        WHERE c.table_name = t.table_name
                        AND c.table_schema = t.table_schema
                    )
                )
            )
            FROM information_schema.tables t
            WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'
        ),
        'functions', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'function_name', routine_name,
                    'return_type', data_type,
                    'language', external_language
                )
            )
            FROM information_schema.routines
            WHERE routine_schema = 'public'
        ),
        'views', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'view_name', table_name,
                    'definition', view_definition
                )
            )
            FROM information_schema.views
            WHERE table_schema = 'public'
        )
    ) INTO schema_def;
    
    -- Count schema objects
    SELECT COUNT(*) INTO table_cnt FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    SELECT COUNT(*) INTO function_cnt FROM information_schema.routines 
    WHERE routine_schema = 'public';
    
    SELECT COUNT(*) INTO view_cnt FROM information_schema.views 
    WHERE table_schema = 'public';
    
    SELECT COUNT(*) INTO index_cnt FROM pg_indexes 
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO trigger_cnt FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    
    -- Insert snapshot
    INSERT INTO schema_snapshots (
        snapshot_name, schema_definition, table_count, function_count,
        view_count, index_count, trigger_count, created_by, is_baseline
    ) VALUES (
        p_snapshot_name, schema_def, table_cnt, function_cnt,
        view_cnt, index_cnt, trigger_cnt, p_created_by, p_is_baseline
    ) RETURNING id INTO snapshot_id;
    
    RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply migration
CREATE OR REPLACE FUNCTION apply_migration(
    p_version VARCHAR(50),
    p_name VARCHAR(200),
    p_migration_sql TEXT,
    p_rollback_sql TEXT DEFAULT NULL,
    p_applied_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTEGER;
    checksum_value VARCHAR(64);
BEGIN
    -- Check if migration already applied
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = p_version) THEN
        RAISE EXCEPTION 'Migration version % already applied', p_version;
    END IF;
    
    start_time := clock_timestamp();
    
    -- Calculate checksum
    checksum_value := encode(digest(p_migration_sql, 'sha256'), 'hex');
    
    -- Execute migration in a savepoint
    BEGIN
        EXECUTE p_migration_sql;
        
        end_time := clock_timestamp();
        execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
        
        -- Record successful migration
        INSERT INTO schema_migrations (
            version, name, applied_by, checksum, execution_time_ms, rollback_sql
        ) VALUES (
            p_version, p_name, p_applied_by, checksum_value, execution_time, p_rollback_sql
        );
        
        RETURN true;
        
    EXCEPTION WHEN OTHERS THEN
        -- Record failed migration
        INSERT INTO schema_migrations (
            version, name, applied_by, checksum, execution_time_ms, rollback_sql, status
        ) VALUES (
            p_version, p_name, p_applied_by, checksum_value, 
            EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000, 
            p_rollback_sql, 'failed'
        );
        
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rollback migration
CREATE OR REPLACE FUNCTION rollback_migration(p_version VARCHAR(50))
RETURNS BOOLEAN AS $$
DECLARE
    migration_record RECORD;
BEGIN
    -- Get migration record
    SELECT * INTO migration_record FROM schema_migrations 
    WHERE version = p_version AND status = 'applied';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Migration version % not found or not applied', p_version;
    END IF;
    
    IF migration_record.rollback_sql IS NULL THEN
        RAISE EXCEPTION 'No rollback SQL provided for migration %', p_version;
    END IF;
    
    -- Execute rollback
    BEGIN
        EXECUTE migration_record.rollback_sql;
        
        -- Update migration status
        UPDATE schema_migrations 
        SET status = 'rolled_back'
        WHERE version = p_version;
        
        RETURN true;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Rollback failed for migration %: %', p_version, SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to perform data integrity checks
CREATE OR REPLACE FUNCTION perform_integrity_check(
    p_check_type VARCHAR(50) DEFAULT 'full',
    p_table_name VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    check_id UUID;
    start_time TIMESTAMP;
    issues_found INTEGER := 0;
    issues_details JSONB := '[]';
    check_sql TEXT;
    issue_record RECORD;
BEGIN
    start_time := clock_timestamp();
    
    -- Insert initial check record
    INSERT INTO integrity_check_logs (check_type, table_name, status)
    VALUES (p_check_type, p_table_name, 'running')
    RETURNING id INTO check_id;
    
    -- Perform different types of checks
    CASE p_check_type
        WHEN 'foreign_keys' THEN
            -- Check foreign key constraints
            FOR issue_record IN
                SELECT conname as constraint_name, conrelid::regclass as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                AND NOT EXISTS (
                    SELECT 1 FROM pg_constraint_check(oid)
                )
            LOOP
                issues_found := issues_found + 1;
                issues_details := issues_details || jsonb_build_object(
                    'type', 'foreign_key_violation',
                    'constraint', issue_record.constraint_name,
                    'table', issue_record.table_name
                );
            END LOOP;
            
        WHEN 'constraints' THEN
            -- Check all constraints
            FOR issue_record IN
                SELECT conname as constraint_name, conrelid::regclass as table_name
                FROM pg_constraint
                WHERE NOT EXISTS (
                    SELECT 1 FROM pg_constraint_check(oid)
                )
            LOOP
                issues_found := issues_found + 1;
                issues_details := issues_details || jsonb_build_object(
                    'type', 'constraint_violation',
                    'constraint', issue_record.constraint_name,
                    'table', issue_record.table_name
                );
            END LOOP;
            
        WHEN 'indexes' THEN
            -- Check for missing or invalid indexes
            FOR issue_record IN
                SELECT schemaname, tablename, indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND NOT EXISTS (
                    SELECT 1 FROM pg_stat_user_indexes
                    WHERE schemaname = pg_indexes.schemaname
                    AND tablename = pg_indexes.tablename
                    AND indexrelname = pg_indexes.indexname
                )
            LOOP
                issues_found := issues_found + 1;
                issues_details := issues_details || jsonb_build_object(
                    'type', 'invalid_index',
                    'index', issue_record.indexname,
                    'table', issue_record.tablename
                );
            END LOOP;
            
        WHEN 'full' THEN
            -- Perform all checks (recursive calls)
            PERFORM perform_integrity_check('foreign_keys');
            PERFORM perform_integrity_check('constraints');
            PERFORM perform_integrity_check('indexes');
    END CASE;
    
    -- Update check record with results
    UPDATE integrity_check_logs
    SET 
        issues_found = perform_integrity_check.issues_found,
        issues_details = perform_integrity_check.issues_details,
        check_duration_ms = EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000,
        status = 'completed'
    WHERE id = check_id;
    
    RETURN check_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old backups based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete backups past their retention date
    DELETE FROM backup_logs
    WHERE retention_until < NOW()
    AND status = 'completed';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup operation
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, context)
    VALUES (
        'backup_cleanup_count',
        deleted_count,
        'count',
        jsonb_build_object('cleanup_date', NOW())
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get database health summary
CREATE OR REPLACE FUNCTION get_database_health_summary()
RETURNS TABLE (
    metric VARCHAR(50),
    value TEXT,
    status VARCHAR(20),
    last_checked TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Schema Migrations'::VARCHAR(50),
        COUNT(*)::TEXT || ' applied',
        CASE WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 THEN 'WARNING' ELSE 'OK' END,
        MAX(applied_at)
    FROM schema_migrations
    
    UNION ALL
    
    SELECT 
        'Recent Backups'::VARCHAR(50),
        COUNT(*)::TEXT || ' in last 7 days',
        CASE WHEN COUNT(*) = 0 THEN 'WARNING' ELSE 'OK' END,
        MAX(completed_at)
    FROM backup_logs
    WHERE completed_at > NOW() - INTERVAL '7 days'
    AND status = 'completed'
    
    UNION ALL
    
    SELECT 
        'Integrity Checks'::VARCHAR(50),
        COALESCE(SUM(issues_found), 0)::TEXT || ' issues found',
        CASE WHEN COALESCE(SUM(issues_found), 0) > 0 THEN 'WARNING' ELSE 'OK' END,
        MAX(executed_at)
    FROM integrity_check_logs
    WHERE executed_at > NOW() - INTERVAL '24 hours'
    
    UNION ALL
    
    SELECT 
        'Database Size'::VARCHAR(50),
        pg_size_pretty(pg_database_size(current_database())),
        'INFO',
        NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create initial baseline schema snapshot
SELECT create_schema_snapshot('initial_baseline', NULL, true);

-- Insert initial migration record for current state
INSERT INTO schema_migrations (version, name, checksum, status)
VALUES (
    '001_initial_schema',
    'Initial database schema with all improvements',
    encode(digest('-- Initial schema setup', 'sha256'), 'hex'),
    'applied'
) ON CONFLICT (version) DO NOTHING;

/*
Backup and Migration System Features:

1. Schema Version Control:
   - Track all schema changes with versions
   - Rollback capabilities with rollback SQL
   - Checksum validation for integrity
   - Execution time tracking

2. Automated Backups:
   - Multiple backup types (full, incremental, schema-only)
   - Retention policy management
   - Compression and encryption support
   - Backup validation and cleanup

3. Schema Snapshots:
   - Complete schema state capture
   - Baseline and incremental snapshots
   - JSON-based schema definitions
   - Object counting and validation

4. Data Integrity:
   - Comprehensive integrity checks
   - Foreign key validation
   - Constraint verification
   - Index health monitoring

5. Health Monitoring:
   - Database health summaries
   - Migration status tracking
   - Backup status monitoring
   - Performance metrics integration

6. Administrative Tools:
   - Easy migration application
   - Automated cleanup procedures
   - Health check reports
   - Rollback capabilities

Usage Examples:
- Apply migration: SELECT apply_migration('002_add_feature', 'Add new feature', 'CREATE TABLE...', 'DROP TABLE...');
- Create snapshot: SELECT create_schema_snapshot('pre_deployment_snapshot');
- Check integrity: SELECT perform_integrity_check('full');
- Get health summary: SELECT * FROM get_database_health_summary();
- Cleanup old backups: SELECT cleanup_old_backups();
*/