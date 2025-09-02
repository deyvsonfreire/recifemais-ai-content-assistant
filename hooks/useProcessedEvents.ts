import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './useAppContext';
import { supabase } from '../services/supabase';
import { analyticsService } from '../services/analyticsService';
import { ProcessedEvent, EventSource, EventCategory } from '../types';

interface ProcessedEventsFilters {
  status?: 'pending' | 'approved' | 'rejected' | 'published';
  categoryId?: number;
  sourceId?: number;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

interface ProcessedEventsStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  published: number;
  byCategory: { [categoryName: string]: number };
  bySource: { [sourceName: string]: number };
}

export const useProcessedEvents = () => {
  const { session } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<ProcessedEvent[]>([]);
  const [sources, setSources] = useState<EventSource[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [stats, setStats] = useState<ProcessedEventsStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    byCategory: {},
    bySource: {}
  });
  const [filters, setFilters] = useState<ProcessedEventsFilters>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  // Carregar fontes de eventos
  const loadEventSources = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('event_sources')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error('Error loading event sources:', error);
    }
  }, []);

  // Carregar categorias de eventos
  const loadEventCategories = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('event_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading event categories:', error);
    }
  }, []);

  // Carregar eventos processados
  const loadProcessedEvents = useCallback(async (resetPagination: boolean = false): Promise<void> => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('processed_events')
        .select(`
          *,
          category:event_categories(*),
          source:event_sources(*),
          scraped_event:scraped_events(*)
        `);

      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.sourceId) {
        query = query.eq('source_id', filters.sourceId);
      }
      if (filters.dateFrom) {
        query = query.gte('event_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('event_date', filters.dateTo);
      }
      if (filters.searchQuery) {
        query = query.or(`title.ilike.%${filters.searchQuery}%,description.ilike.%${filters.searchQuery}%,location.ilike.%${filters.searchQuery}%`);
      }

      // Contar total
      const { count } = await query.select('*', { count: 'exact' });

      // Buscar dados paginados
      const currentPage = resetPagination ? 1 : pagination.page;
      const offset = (currentPage - 1) * pagination.limit;

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + pagination.limit - 1);

      if (error) throw error;

      setEvents(data || []);
      setPagination(prev => ({
        ...prev,
        page: currentPage,
        total: count || 0
      }));

      // Log da ação
      await analyticsService.logUserAction(
        session.user.id,
        'load_processed_events',
        'processed_events',
        undefined,
        { filters, pagination: { page: currentPage, limit: pagination.limit } }
      );

    } catch (error) {
      console.error('Error loading processed events:', error);
      if (session?.user?.id) {
        await analyticsService.logError({
          user_id: session.user.id,
          error_type: 'load_processed_events_error',
          error_message: error instanceof Error ? error.message : String(error),
          stack_trace: error instanceof Error ? error.stack || null : null,
          url: null,
          user_agent: null,
          metadata: { filters }
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, filters, pagination.page, pagination.limit]);

  // Carregar estatísticas
  const loadStats = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      // Contar por status
      const statusCounts = await Promise.all([
        supabase.from('processed_events').select('*', { count: 'exact', head: true }),
        supabase.from('processed_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('processed_events').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('processed_events').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('processed_events').select('*', { count: 'exact', head: true }).eq('status', 'published')
      ]);

      // Contar por categoria
      const { data: categoryData } = await supabase
        .from('processed_events')
        .select('category_id, category:event_categories(name)')
        .not('category_id', 'is', null);

      const byCategory: { [categoryName: string]: number } = {};
      categoryData?.forEach(event => {
        const categoryName = (event.category as any)?.name || 'Sem categoria';
        byCategory[categoryName] = (byCategory[categoryName] || 0) + 1;
      });

      // Contar por fonte
      const { data: sourceData } = await supabase
        .from('processed_events')
        .select('source_id, source:event_sources(name)')
        .not('source_id', 'is', null);

      const bySource: { [sourceName: string]: number } = {};
      sourceData?.forEach(event => {
        const sourceName = (event.source as any)?.name || 'Sem fonte';
        bySource[sourceName] = (bySource[sourceName] || 0) + 1;
      });

      setStats({
        total: statusCounts[0].count || 0,
        pending: statusCounts[1].count || 0,
        approved: statusCounts[2].count || 0,
        rejected: statusCounts[3].count || 0,
        published: statusCounts[4].count || 0,
        byCategory,
        bySource
      });

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [session?.user?.id]);

  // Criar evento processado
  const createProcessedEvent = useCallback(async (eventData: Omit<ProcessedEvent, 'id' | 'created_at' | 'updated_at'>): Promise<ProcessedEvent | null> => {
    if (!session?.user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('processed_events')
        .insert({
          ...eventData,
          user_id: session.user.id
        })
        .select(`
          *,
          category:event_categories(*),
          source:event_sources(*),
          scraped_event:scraped_events(*)
        `)
        .single();

      if (error) throw error;

      // Atualizar lista local
      setEvents(prev => [data, ...prev]);
      
      // Log da ação
      await analyticsService.logUserAction(
        session.user.id,
        'create_processed_event',
        'processed_events',
        data.id.toString(),
        { title: data.title, status: data.status }
      );

      return data;
    } catch (error) {
      console.error('Error creating processed event:', error);
      if (session?.user?.id) {
        await analyticsService.logError({
          user_id: session.user.id,
          error_type: 'create_processed_event_error',
          error_message: error instanceof Error ? error.message : String(error),
          stack_trace: error instanceof Error ? error.stack || null : null,
          url: null,
          user_agent: null,
          metadata: { eventData }
        });
      }
      throw error;
    }
  }, [session?.user?.id]);

  // Atualizar evento processado
  const updateProcessedEvent = useCallback(async (id: number, updates: Partial<ProcessedEvent>): Promise<ProcessedEvent | null> => {
    if (!session?.user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('processed_events')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          category:event_categories(*),
          source:event_sources(*),
          scraped_event:scraped_events(*)
        `)
        .single();

      if (error) throw error;

      // Atualizar lista local
      setEvents(prev => prev.map(event => event.id === id ? data : event));
      
      // Log da ação
      await analyticsService.logUserAction(
        session.user.id,
        'update_processed_event',
        'processed_events',
        id.toString(),
        { updates }
      );

      return data;
    } catch (error) {
      console.error('Error updating processed event:', error);
      if (session?.user?.id) {
        await analyticsService.logError({
          user_id: session.user.id,
          error_type: 'update_processed_event_error',
          error_message: error instanceof Error ? error.message : String(error),
          stack_trace: error instanceof Error ? error.stack || null : null,
          url: null,
          user_agent: null,
          metadata: { id, updates }
        });
      }
      throw error;
    }
  }, [session?.user?.id]);

  // Deletar evento processado
  const deleteProcessedEvent = useCallback(async (id: number): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('processed_events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Remover da lista local
      setEvents(prev => prev.filter(event => event.id !== id));
      
      // Log da ação
      await analyticsService.logUserAction(
        session.user.id,
        'delete_processed_event',
        'processed_events',
        id.toString()
      );

    } catch (error) {
      console.error('Error deleting processed event:', error);
      if (session?.user?.id) {
        await analyticsService.logError({
          user_id: session.user.id,
          error_type: 'delete_processed_event_error',
          error_message: error instanceof Error ? error.message : String(error),
          stack_trace: error instanceof Error ? error.stack || null : null,
          url: null,
          user_agent: null,
          metadata: { id }
        });
      }
      throw error;
    }
  }, [session?.user?.id]);

  // Atualizar filtros
  const updateFilters = useCallback((newFilters: Partial<ProcessedEventsFilters>): void => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Limpar filtros
  const clearFilters = useCallback((): void => {
    setFilters({});
  }, []);

  // Mudar página
  const changePage = useCallback((page: number): void => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  // Mudar limite por página
  const changeLimit = useCallback((limit: number): void => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
  }, []);

  // Obter evento por ID
  const getEventById = useCallback((id: number): ProcessedEvent | undefined => {
    return events.find(event => event.id === id);
  }, [events]);

  // Obter eventos por status
  const getEventsByStatus = useCallback((status: ProcessedEvent['status']): ProcessedEvent[] => {
    return events.filter(event => event.status === status);
  }, [events]);

  // Carregar dados iniciais
  useEffect(() => {
    loadEventSources();
    loadEventCategories();
    loadStats();
  }, [loadEventSources, loadEventCategories, loadStats]);

  // Recarregar eventos quando filtros ou paginação mudarem
  useEffect(() => {
    loadProcessedEvents();
  }, [filters, pagination.page, pagination.limit]);

  return {
    isLoading,
    events,
    sources,
    categories,
    stats,
    filters,
    pagination,
    loadProcessedEvents,
    loadStats,
    createProcessedEvent,
    updateProcessedEvent,
    deleteProcessedEvent,
    updateFilters,
    clearFilters,
    changePage,
    changeLimit,
    getEventById,
    getEventsByStatus
  };
};