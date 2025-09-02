import { supabase } from './supabase';
import { ScrapedEvent, EventCache } from '../types';
import { analyticsService } from './analyticsService';

export const eventCacheService = {
  async getRecentCachedEvents(userId: string, searchQuery: string): Promise<ScrapedEvent[]> {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    
    try {
      const { data, error } = await supabase
        .from('event_cache')
        .select('*')
        .eq('user_id', userId)
        .eq('search_query', searchQuery)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching cached events:', error);
        await analyticsService.logError({
          user_id: userId,
          error_type: 'cache_fetch_error',
          error_message: error.message,
          stack_trace: null,
          url: null,
          user_agent: null,
          metadata: { search_query: searchQuery }
        });
        return [];
      }

      if (data && data.length > 0) {
        // Incrementar contador de cache hit
        await this.incrementCacheHit(userId, searchQuery);
        
        // Log da ação
        await analyticsService.logUserAction(
          userId, 
          'cache_hit', 
          'event_cache', 
          searchQuery,
          { events_count: data[0].cached_data?.length || 0 }
        );

        return data[0].cached_data as ScrapedEvent[];
      }

      // Log de cache miss
      await analyticsService.logUserAction(
        userId, 
        'cache_miss', 
        'event_cache', 
        searchQuery
      );

      return [];
    } catch (error) {
      console.error('Error in getRecentCachedEvents:', error);
      await analyticsService.logError({
        user_id: userId,
        error_type: 'cache_service_error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        stack_trace: error instanceof Error ? error.stack || null : null,
        url: null,
        user_agent: null,
        metadata: { search_query: searchQuery, action: 'get_cached_events' }
      });
      return [];
    }
  },

  async cacheEvents(userId: string, searchQuery: string, events: ScrapedEvent[], source?: string): Promise<void> {
    try {
      // Limpar cache antigo para esta query
      await this.clearOldCache(userId, searchQuery);

      const { error } = await supabase
        .from('event_cache')
        .insert({
          user_id: userId,
          search_query: searchQuery,
          cached_data: events,
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          source: source || 'unknown',
          cache_hit_count: 0,
          data_size_bytes: JSON.stringify(events).length
        });

      if (error) {
        console.error('Error caching events:', error);
        await analyticsService.logError({
          user_id: userId,
          error_type: 'cache_store_error',
          error_message: error.message,
          stack_trace: null,
          url: null,
          user_agent: null,
          metadata: { 
            search_query: searchQuery, 
            events_count: events.length,
            source 
          }
        });
        throw error;
      }

      // Log da ação de cache
      await analyticsService.logUserAction(
        userId, 
        'cache_store', 
        'event_cache', 
        searchQuery,
        { 
          events_count: events.length,
          source,
          data_size: JSON.stringify(events).length
        }
      );

      // Registrar métrica de performance
      await analyticsService.recordPerformanceMetric(
        'cache_store_size',
        events.length,
        'events',
        { user_id: userId, source }
      );

    } catch (error) {
      console.error('Error in cacheEvents:', error);
      await analyticsService.logError({
        user_id: userId,
        error_type: 'cache_service_error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        stack_trace: error instanceof Error ? error.stack || null : null,
        url: null,
        user_agent: null,
        metadata: { 
          search_query: searchQuery, 
          events_count: events.length,
          action: 'cache_events'
        }
      });
      throw error;
    }
  },

  async incrementCacheHit(userId: string, searchQuery: string): Promise<void> {
    try {
      // Primeiro buscar o valor atual
      const { data: currentData } = await supabase
        .from('event_cache')
        .select('cache_hit_count')
        .eq('user_id', userId)
        .eq('search_query', searchQuery)
        .single();

      const newHitCount = (currentData?.cache_hit_count || 0) + 1;

      const { error } = await supabase
        .from('event_cache')
        .update({ 
          cache_hit_count: newHitCount
        })
        .eq('user_id', userId)
        .eq('search_query', searchQuery);

      if (error) {
        console.error('Error incrementing cache hit:', error);
      }
    } catch (error) {
      console.error('Error in incrementCacheHit:', error);
    }
  },

  async clearOldCache(userId: string, searchQuery?: string): Promise<void> {
    try {
      let query = supabase
        .from('event_cache')
        .delete()
        .eq('user_id', userId);

      if (searchQuery) {
        query = query.eq('search_query', searchQuery);
      } else {
        // Limpar cache expirado
        query = query.lt('expires_at', new Date().toISOString());
      }

      const { error } = await query;

      if (error) {
        console.error('Error clearing old cache:', error);
      }
    } catch (error) {
      console.error('Error in clearOldCache:', error);
    }
  },

  async getCacheStats(userId: string): Promise<{
    total_entries: number;
    total_hits: number;
    total_size_bytes: number;
    most_popular_queries: Array<{ search_query: string; hit_count: number }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('event_cache')
        .select('search_query, cache_hit_count, data_size_bytes')
        .eq('user_id', userId)
        .gte('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching cache stats:', error);
        throw error;
      }

      const totalEntries = data?.length || 0;
      const totalHits = data?.reduce((sum, entry) => sum + (entry.cache_hit_count || 0), 0) || 0;
      const totalSizeBytes = data?.reduce((sum, entry) => sum + (entry.data_size_bytes || 0), 0) || 0;
      
      const mostPopularQueries = data
        ?.sort((a, b) => (b.cache_hit_count || 0) - (a.cache_hit_count || 0))
        .slice(0, 10)
        .map(entry => ({
          search_query: entry.search_query,
          hit_count: entry.cache_hit_count || 0
        })) || [];

      return {
          total_entries: totalEntries,
          total_hits: totalHits,
          total_size_bytes: totalSizeBytes,
          most_popular_queries: mostPopularQueries
        };
      } catch (error) {
      console.error('Error in getCacheStats:', error);
      throw error;
    }
  },

  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('event_cache')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error invalidating user cache:', error);
        throw error;
      }

      await analyticsService.logUserAction(
        userId, 
        'cache_invalidate', 
        'event_cache', 
        'all'
      );
    } catch (error) {
      console.error('Error in invalidateUserCache:', error);
      throw error;
    }
  }
};

// Exportações individuais para compatibilidade
export const getRecentCachedEvents = eventCacheService.getRecentCachedEvents.bind(eventCacheService);
export const cacheEvents = eventCacheService.cacheEvents.bind(eventCacheService);
