// Tipos gerados automaticamente para o banco de dados Supabase
// Baseado nas tabelas criadas pelas migrações

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: string;
          wp_site_url: string | null;
          wp_username: string | null;
          wp_application_password: string | null;
          ai_tone: string | null;
          ai_system_instruction: string | null;
          sympla_api_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          role?: string;
          wp_site_url?: string | null;
          wp_username?: string | null;
          wp_application_password?: string | null;
          ai_tone?: string | null;
          ai_system_instruction?: string | null;
          sympla_api_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string;
          wp_site_url?: string | null;
          wp_username?: string | null;
          wp_application_password?: string | null;
          ai_tone?: string | null;
          ai_system_instruction?: string | null;
          sympla_api_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      scraped_events: {
        Row: {
          id: number;
          source_url: string;
          source_site: string;
          raw_title: string | null;
          raw_date: string | null;
          raw_location: string | null;
          raw_data: any;
          scraped_at: string;
          processed_at: string | null;
          created_at: string | null;
          processed: boolean | null;
          source: string | null;
        };
        Insert: {
          id?: number;
          source_url: string;
          source_site: string;
          raw_title?: string | null;
          raw_date?: string | null;
          raw_location?: string | null;
          raw_data?: any;
          scraped_at?: string;
          processed_at?: string | null;
          created_at?: string | null;
          processed?: boolean | null;
          source?: string | null;
        };
        Update: {
          id?: number;
          source_url?: string;
          source_site?: string;
          raw_title?: string | null;
          raw_date?: string | null;
          raw_location?: string | null;
          raw_data?: any;
          scraped_at?: string;
          processed_at?: string | null;
          created_at?: string | null;
          processed?: boolean | null;
          source?: string | null;
        };
      };
      event_cache: {
        Row: {
          id: number;
          user_id: string;
          search_query: string;
          events_data: any;
          sources_data: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          search_query: string;
          events_data: any;
          sources_data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          search_query?: string;
          events_data?: any;
          sources_data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_sources: {
        Row: {
          id: number;
          name: string;
          url: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          url: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          url?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_categories: {
        Row: {
          id: number;
          name: string;
          slug: string;
          description: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          slug: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          slug?: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      processed_events: {
        Row: {
          id: number;
          scraped_event_id: number;
          user_id: string;
          title: string;
          description: string | null;
          event_date: string | null;
          location: string | null;
          category_id: number | null;
          source_id: number | null;
          status: string;
          metadata: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          scraped_event_id: number;
          user_id: string;
          title: string;
          description?: string | null;
          event_date?: string | null;
          location?: string | null;
          category_id?: number | null;
          source_id?: number | null;
          status?: string;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          scraped_event_id?: number;
          user_id?: string;
          title?: string;
          description?: string | null;
          event_date?: string | null;
          location?: string | null;
          category_id?: number | null;
          source_id?: number | null;
          status?: string;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      usage_logs: {
        Row: {
          id: number;
          user_id: string;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          action?: string;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: any;
          created_at?: string;
        };
      };
      api_usage_logs: {
        Row: {
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
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          endpoint: string;
          method: string;
          status_code: number;
          response_time_ms?: number | null;
          request_size_bytes?: number | null;
          response_size_bytes?: number | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          endpoint?: string;
          method?: string;
          status_code?: number;
          response_time_ms?: number | null;
          request_size_bytes?: number | null;
          response_size_bytes?: number | null;
          user_agent?: string | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
      performance_metrics: {
        Row: {
          id: number;
          metric_name: string;
          metric_value: number;
          unit: string | null;
          tags: any;
          created_at: string;
        };
        Insert: {
          id?: number;
          metric_name: string;
          metric_value: number;
          unit?: string | null;
          tags?: any;
          created_at?: string;
        };
        Update: {
          id?: number;
          metric_name?: string;
          metric_value?: number;
          unit?: string | null;
          tags?: any;
          created_at?: string;
        };
      };
    };
    Views: {
      mv_user_activity_summary: {
        Row: {
          user_id: string | null;
          total_actions: number | null;
          last_activity: string | null;
          most_used_feature: string | null;
        };
      };
      mv_daily_usage_stats: {
        Row: {
          date: string | null;
          total_users: number | null;
          total_actions: number | null;
          avg_session_duration: number | null;
        };
      };
      mv_feature_popularity: {
        Row: {
          feature: string | null;
          usage_count: number | null;
          unique_users: number | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}