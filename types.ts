export enum Page {
  Dashboard = 'Dashboard',
  AIAssistant = 'Assistente IA',
  EventSearch = 'Busca de Eventos',
  ScrapedEvents = 'Eventos Coletados',
  Noticias = 'Notícias',
  Agenda = 'Agenda',
  Artistas = 'Artistas',
  Historias = 'Histórias',
  Organizadores = 'Organizadores',
  Lugares = 'Lugares',
  Settings = 'Configurações',
}

export interface ScrapedEvent {
  id: number;
  source_url: string;
  source_site: string;
  raw_title: string | null;
  raw_date: string | null;
  raw_location: string | null;
  raw_data: any; // jsonb
  scraped_at: string;
  processed_at: string | null;
  created_at?: string | null;
  processed?: boolean | null;
  source?: string | null;
}

// Novas interfaces para as tabelas normalizadas
export interface EventSource {
  id: number;
  name: string;
  url: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessedEvent {
  id: number;
  scraped_event_id: number;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  category_id: number | null;
  source_id: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  metadata: any;
  created_at: string;
  updated_at: string;
  // Relacionamentos
  category?: EventCategory;
  source?: EventSource;
  scraped_event?: ScrapedEvent;
}

// Interfaces para Analytics e Monitoramento
export interface UsageLog {
  id: number;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: any;
  created_at: string;
}

export interface ApiUsageLog {
  id: number;
  user_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number | null;
  request_size_bytes: number | null;
  response_size_bytes: number | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface PerformanceMetric {
  id: number;
  metric_name: string;
  metric_value: number;
  unit: string | null;
  tags: any;
  created_at: string;
}

export interface FeatureUsageStats {
  id: number;
  feature_name: string;
  usage_count: number;
  unique_users: number;
  date: string;
  created_at: string;
}

export interface UserSession {
  id: number;
  user_id: string;
  session_start: string;
  session_end: string | null;
  duration_minutes: number | null;
  pages_visited: number;
  actions_performed: number;
  created_at: string;
}

export interface ErrorLog {
  id: number;
  user_id: string | null;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  url: string | null;
  user_agent: string | null;
  severity?: string | null;
  metadata: any;
  created_at: string;
}

export interface EventCache {
  id: string;
  user_id: string;
  search_query: string;
  cached_data: any;
  expires_at: string;
  source: string | null;
  cache_hit_count: number;
  data_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

// Interfaces para Views Materializadas
export interface UserActivitySummary {
  user_id: string;
  total_actions: number;
  last_activity: string;
  most_used_feature: string;
}

export interface DailyUsageStats {
  date: string;
  total_users: number;
  total_actions: number;
  avg_session_duration: number;
}

export interface FeaturePopularity {
  feature: string;
  usage_count: number;
  unique_users: number;
}

export interface ContentAnalytics {
  content_type: string;
  total_created: number;
  total_published: number;
  avg_creation_time: number;
}

export interface ErrorAnalysis {
  error_type: string;
  error_count: number;
  affected_users: number;
  first_occurrence: string;
  last_occurrence: string;
}

export interface PerformanceSummary {
  metric_name: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  sample_count: number;
}

export interface EventDetails {
  name: string;
  date: string;
  location: string;
}

export interface ExtractedFacts {
  eventName: string | null;
  eventDate: string | null;
  eventLocation: string | null;
  organizers: string[] | null;
  keyPeople: string[] | null;
}

export interface ArticleDraft {
  title: string;
  importance: 'Alta' | 'Média' | 'Baixa';
  category: string;
  subcategory: string;
  tags: string[];
  seo_description: string;
  article_body_html: string;
  summary: string;
  focus_keyword: string;
  suggested_alt_text: string;
  event_details?: EventDetails;
  verified_facts: ExtractedFacts | null;
  suggested_image_searches?: string[];
}

export interface HistoriaDraft {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  seo_description: string;
  article_body_html: string;
  focus_keyword: string;
  suggested_alt_text: string;
}

export interface OrganizadorDraft {
  title: string;
  description_html: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
}

export interface PlaceDetailsDraft {
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
}

export type AnyDraft = ArticleDraft | HistoriaDraft | OrganizadorDraft;
export type GenerationType = 'noticia' | 'evento' | 'social' | 'historia' | 'organizador';

export interface ScrapedEventDetails {
    title?: string;
    date?: string;
    location?: string;
    description?: string;
    imageUrl?: string;
    sourceUrl: string;
}


export interface InitialPostData {
  title: string;
  content: string;
  focusKeyword: string;
  categoryIds: number[];
  tagIds: number[];
}

export interface InitialAgendaData {
    title: string;
    content: string;
    eventDate: string;
    eventTime: string;
}

export interface InitialHistoriaData {
    title: string;
    content: string;
    focusKeyword: string;
    categoryIds: number[];
    tagIds: number[];
}

export interface InitialOrganizadorData {
    title: string;
    content: string;
    address: string;
    phone: string;
    website: string;
    instagram: string;
}

export interface GroundingSource {
    web: {
        uri: string;
        title: string;
    }
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  email?: string;
  wp_site_url?: string;
  wp_username?: string;
  wp_application_password?: string;
  ai_tone?: 'Jornalístico (Padrão)' | 'Entusiasmado' | 'Formal' | 'Casual';
  ai_system_instruction?: string;
}

export interface AiPreferences {
  tone: 'Jornalístico (Padrão)' | 'Entusiasmado' | 'Formal' | 'Casual';
  systemInstruction: string;
  enabledProviders: string[];
  preferredProvider: string | null;
}

export interface AIProviderConfig {
  name: string;
  isEnabled: boolean;
  isAvailable: boolean;
  priority: number;
  description: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
}

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface GoogleEvent {
  name: string;
  start_date: string; // "YYYY-MM-DD HH:MM:SS"
  location: string;   // "City, State"
  venue: string;      // "Venue Name"
  summary: string;
  source_url: string;
  category: string;
}
// Fix: Added missing SymplaEvent and SymplaCredentials interfaces
export interface SymplaCredentials {
  apiToken?: string;
}

export interface SymplaEvent {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  url: string;
  detail: string;
  city: string;
  state: string;
  image: string;
}


export interface WordPressPost {
  id: number;
  date: string;
  link: string;
  title: {
    rendered: string;
  };
  content?: {
    rendered: string;
    raw?: string; 
  };
  excerpt?: {
    rendered: string;
    raw?: string;
  };
  status: 'publish' | 'future' | 'draft' | 'pending' | 'private';
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  meta?: { [key: string]: any };
  _embedded?: {
    'wp:featuredmedia'?: {
      id: number;
      source_url: string;
      alt_text: string;
    }[];
  };
}

export interface WordPressTaxonomy {
  name: string;
  slug: string;
  rest_base: string;
  hierarchical: boolean;
}

export interface WordPressTerm {
  id: number;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
}

// SEO Analyzer Types
export interface SeoCheck {
    check: string;
    status: 'pass' | 'fail' | 'neutral';
    feedback: string;
    category: 'Basic' | 'Additional' | 'Title' | 'Content';
}

export interface SeoAnalysis {
    score: number;
    checks: SeoCheck[];
}