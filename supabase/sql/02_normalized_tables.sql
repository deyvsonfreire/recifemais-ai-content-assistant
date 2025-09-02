-- Normalized Tables for RecifeMais AI Content Assistant
-- This file creates normalized tables to improve data structure and reduce redundancy

-- Event Sources Table
-- Centralizes event source information
CREATE TABLE IF NOT EXISTS event_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    base_url TEXT,
    api_endpoint TEXT,
    scraping_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event Categories Table
-- Standardizes event categorization
CREATE TABLE IF NOT EXISTS event_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color_hex VARCHAR(7), -- For UI display
    icon VARCHAR(50), -- Icon identifier
    parent_id INTEGER REFERENCES event_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processed Events Table
-- Tracks AI processing history and results
CREATE TABLE IF NOT EXISTS processed_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scraped_event_id UUID REFERENCES scraped_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    processing_type VARCHAR(50) NOT NULL, -- 'article', 'historia', 'organizador', etc.
    ai_model VARCHAR(50), -- 'gemini-pro', 'gpt-4', etc.
    prompt_template TEXT,
    generated_content JSONB,
    processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Event Tags Table (Many-to-Many relationship)
CREATE TABLE IF NOT EXISTS event_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for events and tags
CREATE TABLE IF NOT EXISTS scraped_event_tags (
    scraped_event_id UUID REFERENCES scraped_events(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES event_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (scraped_event_id, tag_id)
);

-- User Preferences Table
-- Stores user-specific AI and content preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    ai_model_preference VARCHAR(50) DEFAULT 'gemini-pro',
    default_content_type VARCHAR(50) DEFAULT 'article',
    auto_publish BOOLEAN DEFAULT false,
    preferred_categories INTEGER[] DEFAULT '{}',
    content_style_preferences JSONB DEFAULT '{}',
    notification_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints to existing tables (if they don't exist)
-- Note: These would need to be run after data migration

-- ALTER TABLE scraped_events ADD COLUMN IF NOT EXISTS source_id INTEGER REFERENCES event_sources(id);
-- ALTER TABLE scraped_events ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES event_categories(id);

-- Create indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_event_sources_active ON event_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_event_sources_name ON event_sources(name);

CREATE INDEX IF NOT EXISTS idx_event_categories_active ON event_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_event_categories_slug ON event_categories(slug);
CREATE INDEX IF NOT EXISTS idx_event_categories_parent ON event_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_processed_events_scraped_event ON processed_events(scraped_event_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_user ON processed_events(user_id);
CREATE INDEX IF NOT EXISTS idx_processed_events_status ON processed_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_events_type ON processed_events(processing_type);
CREATE INDEX IF NOT EXISTS idx_processed_events_created ON processed_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_tags_name ON event_tags(name);
CREATE INDEX IF NOT EXISTS idx_event_tags_usage ON event_tags(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_event_sources_updated_at BEFORE UPDATE ON event_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_categories_updated_at BEFORE UPDATE ON event_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO event_sources (name, base_url, is_active) VALUES
('Sympla', 'https://www.sympla.com.br', true),
('Eventbrite', 'https://www.eventbrite.com.br', true),
('Manual', NULL, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO event_categories (name, slug, description) VALUES
('Música', 'musica', 'Shows, concertos e eventos musicais'),
('Teatro', 'teatro', 'Peças teatrais e espetáculos'),
('Gastronomia', 'gastronomia', 'Eventos gastronômicos e culinários'),
('Esportes', 'esportes', 'Eventos esportivos e competições'),
('Educação', 'educacao', 'Workshops, cursos e palestras'),
('Arte', 'arte', 'Exposições e eventos artísticos'),
('Tecnologia', 'tecnologia', 'Eventos de tecnologia e inovação'),
('Negócios', 'negocios', 'Networking e eventos corporativos')
ON CONFLICT (name) DO NOTHING;

-- Comments explaining the normalized structure
/*
Normalization Benefits:

1. Event Sources:
   - Centralizes source configuration
   - Enables source-specific scraping settings
   - Tracks source reliability and status

2. Event Categories:
   - Standardizes categorization
   - Supports hierarchical categories
   - Enables better filtering and organization

3. Processed Events:
   - Tracks AI processing history
   - Enables cost tracking and optimization
   - Supports multiple processing types per event
   - Provides audit trail for AI operations

4. Event Tags:
   - Flexible tagging system
   - Many-to-many relationship with events
   - Usage tracking for popular tags

5. User Preferences:
   - Personalizes user experience
   - Stores AI model preferences
   - Enables user-specific defaults
*/