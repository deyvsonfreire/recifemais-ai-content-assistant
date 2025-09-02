-- Performance Indexes for RecifeMais AI Content Assistant
-- This file creates indexes to optimize common queries

-- Indexes for scraped_events table
-- Optimize queries by date range and processing status
CREATE INDEX IF NOT EXISTS idx_scraped_events_created_at ON scraped_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_events_processed ON scraped_events(processed);
CREATE INDEX IF NOT EXISTS idx_scraped_events_event_date ON scraped_events(event_date);
CREATE INDEX IF NOT EXISTS idx_scraped_events_source ON scraped_events(source);

-- Composite index for common filtering patterns
CREATE INDEX IF NOT EXISTS idx_scraped_events_processed_date ON scraped_events(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_events_source_date ON scraped_events(source, event_date);

-- Indexes for event_cache table
-- Optimize cache lookups and cleanup operations
CREATE INDEX IF NOT EXISTS idx_event_cache_user_id ON event_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_event_cache_created_at ON event_cache(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_cache_search_params ON event_cache USING gin(search_params);

-- Composite index for user-specific cache queries
CREATE INDEX IF NOT EXISTS idx_event_cache_user_created ON event_cache(user_id, created_at DESC);

-- Indexes for profiles table
-- Optimize user authentication and profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at DESC);

-- Partial indexes for active users (assuming there's an active/status field)
-- CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(id) WHERE active = true;

-- Text search indexes (if using full-text search)
-- For scraped_events content search
CREATE INDEX IF NOT EXISTS idx_scraped_events_title_search ON scraped_events USING gin(to_tsvector('portuguese', title));
CREATE INDEX IF NOT EXISTS idx_scraped_events_description_search ON scraped_events USING gin(to_tsvector('portuguese', description));

-- Comments explaining the indexes
/*
Index Strategy Explanation:

1. Single Column Indexes:
   - created_at (DESC): For recent records queries
   - processed: For filtering processed/unprocessed events
   - user_id: For user-specific data retrieval
   - email: For authentication lookups

2. Composite Indexes:
   - (processed, created_at): For queries filtering by status and ordering by date
   - (user_id, created_at): For user timeline queries
   - (source, event_date): For source-specific event queries

3. Specialized Indexes:
   - GIN indexes for JSONB columns (search_params)
   - Full-text search indexes for Portuguese content
   - Partial indexes for frequently accessed subsets

4. Performance Considerations:
   - DESC ordering on timestamp columns for recent-first queries
   - Composite indexes match common WHERE clause patterns
   - GIN indexes for complex JSON queries
*/