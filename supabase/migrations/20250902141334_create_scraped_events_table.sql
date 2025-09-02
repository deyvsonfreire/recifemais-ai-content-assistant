-- Create scraped_events table
-- This table stores raw event data collected from various sources

CREATE TABLE IF NOT EXISTS scraped_events (
    id SERIAL PRIMARY KEY,
    raw_title TEXT NOT NULL,
    raw_description TEXT,
    source_site VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL UNIQUE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_date TIMESTAMP WITH TIME ZONE,
    location TEXT,
    price_info TEXT,
    image_url TEXT,
    tags TEXT[],
    raw_data JSONB,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(255) -- For compatibility with existing code
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scraped_events_created_at ON scraped_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_events_processed ON scraped_events(processed);
CREATE INDEX IF NOT EXISTS idx_scraped_events_event_date ON scraped_events(event_date);
CREATE INDEX IF NOT EXISTS idx_scraped_events_source ON scraped_events(source);
CREATE INDEX IF NOT EXISTS idx_scraped_events_processed_date ON scraped_events(processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraped_events_source_date ON scraped_events(source, event_date);
CREATE INDEX IF NOT EXISTS idx_scraped_events_source_url ON scraped_events(source_url);

-- Text search indexes for Portuguese content
CREATE INDEX IF NOT EXISTS idx_scraped_events_title_search ON scraped_events USING gin(to_tsvector('portuguese', raw_title));
CREATE INDEX IF NOT EXISTS idx_scraped_events_description_search ON scraped_events USING gin(to_tsvector('portuguese', COALESCE(raw_description, '')));

-- Enable Row Level Security
ALTER TABLE scraped_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Authenticated users can view scraped events" ON scraped_events;
CREATE POLICY "Authenticated users can view scraped events" ON scraped_events
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage scraped events" ON scraped_events;
CREATE POLICY "Service role can manage scraped events" ON scraped_events
    FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scraped_events_updated_at 
    BEFORE UPDATE ON scraped_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();