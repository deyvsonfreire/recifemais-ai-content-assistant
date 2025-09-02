-- Add WordPress integration fields to profiles table
-- This migration adds the missing WordPress fields that the application expects

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wp_site_url VARCHAR(500);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wp_username VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wp_application_password VARCHAR(500);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_tone VARCHAR(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_system_instruction TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sympla_api_token VARCHAR(500);

-- Update existing profiles to use full_name as name if name is null
UPDATE profiles SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- Set default values for new fields
UPDATE profiles SET 
    wp_site_url = '',
    wp_username = '',
    wp_application_password = '',
    ai_tone = 'Jornalístico (Padrão)',
    ai_system_instruction = 'Você é um jornalista expert e editor de SEO para o portal de notícias ''recifemais.com.br''. Seu público é o ''Conectado Recifense'' (24-45 anos), interessado em cultura, serviços e acontecimentos locais.',
    sympla_api_token = ''
WHERE wp_site_url IS NULL;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name);
CREATE INDEX IF NOT EXISTS idx_profiles_wp_site_url ON profiles(wp_site_url);

-- Add comment to document the changes
COMMENT ON COLUMN profiles.wp_site_url IS 'WordPress site URL for content publishing';
COMMENT ON COLUMN profiles.wp_username IS 'WordPress username for API authentication';
COMMENT ON COLUMN profiles.wp_application_password IS 'WordPress application password for API access';
COMMENT ON COLUMN profiles.ai_tone IS 'Preferred AI writing tone for content generation';
COMMENT ON COLUMN profiles.ai_system_instruction IS 'Custom system instruction for AI content generation';
COMMENT ON COLUMN profiles.sympla_api_token IS 'Sympla API token for event integration';