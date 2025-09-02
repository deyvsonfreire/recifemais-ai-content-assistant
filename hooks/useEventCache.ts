import { useState, useCallback } from 'react';
import { useAppContext } from './useAppContext';
import { eventCacheService } from '../services/eventCacheService';
import { ScrapedEvent } from '../types';

export const useEventCache = () => {
  const { session } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    total_entries: number;
    total_hits: number;
    total_size_bytes: number;
    most_popular_queries: Array<{ search_query: string; hit_count: number }>;
  } | null>(null);

  // Buscar eventos em cache
  const getCachedEvents = useCallback(async (searchQuery: string): Promise<ScrapedEvent[]> => {
    if (!session?.user?.id) return [];

    setIsLoading(true);
    try {
      const events = await eventCacheService.getRecentCachedEvents(session.user.id, searchQuery);
      return events;
    } catch (error) {
      console.error('Error fetching cached events:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Armazenar eventos em cache
  const cacheEvents = useCallback(async (
    searchQuery: string, 
    events: ScrapedEvent[], 
    source?: string
  ): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      await eventCacheService.cacheEvents(session.user.id, searchQuery, events, source);
    } catch (error) {
      console.error('Error caching events:', error);
      throw error;
    }
  }, [session?.user?.id]);

  // Limpar cache antigo
  const clearOldCache = useCallback(async (searchQuery?: string): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      await eventCacheService.clearOldCache(session.user.id, searchQuery);
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }, [session?.user?.id]);

  // Invalidar cache do usuário
  const invalidateUserCache = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      await eventCacheService.invalidateUserCache(session.user.id);
    } catch (error) {
      console.error('Error invalidating cache:', error);
      throw error;
    }
  }, [session?.user?.id]);

  // Buscar estatísticas do cache
  const fetchCacheStats = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const stats = await eventCacheService.getCacheStats(session.user.id);
      setCacheStats(stats);
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      setCacheStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Calcular taxa de acerto do cache
  const getCacheHitRate = useCallback((): number => {
    if (!cacheStats || cacheStats.total_entries === 0) return 0;
    return (cacheStats.total_hits / cacheStats.total_entries) * 100;
  }, [cacheStats]);

  // Formatar tamanho do cache
  const formatCacheSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return {
    isLoading,
    cacheStats,
    getCachedEvents,
    cacheEvents,
    clearOldCache,
    invalidateUserCache,
    fetchCacheStats,
    getCacheHitRate,
    formatCacheSize
  };
};