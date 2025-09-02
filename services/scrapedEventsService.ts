import { supabase } from './supabase';
import { ScrapedEvent, ProcessedEvent, EventSource, EventCategory } from '../types';

export const scrapedEventsService = {
  // Buscar eventos não processados
  async getUnprocessedEvents(): Promise<ScrapedEvent[]> {
    console.log('📋 Buscando eventos não processados...');
    
    try {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('scraped_events')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: false });

      const duration = Date.now() - startTime;

      if (error) {
        console.error('❌ Erro ao buscar eventos não processados:', {
          error: error.message,
          code: error.code,
          details: error.details,
          duration,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Falha ao buscar eventos: ${error.message}`);
      }

      console.log(`✅ Encontrados ${data?.length || 0} eventos não processados:`, {
        count: data?.length || 0,
        duration,
        oldestEvent: data?.[0]?.created_at,
        newestEvent: data?.[data.length - 1]?.created_at
      });

      return data || [];
    } catch (error) {
      console.error('❌ Erro crítico em getUnprocessedEvents:', {
        error: error instanceof Error ? error.message : error,
        timestamp: new Date().toISOString()
      });
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido ao buscar eventos');
    }
  },

  // Buscar eventos processados com relacionamentos
  async getProcessedEvents(userId: string, limit: number = 50): Promise<ProcessedEvent[]> {
    const { data, error } = await supabase
      .from('processed_events')
      .select(`
        *,
        category:event_categories(*),
        source:event_sources(*),
        scraped_event:scraped_events(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching processed events:', error);
      throw error;
    }

    return data || [];
  },

  // Criar evento processado
  async createProcessedEvent(eventData: Omit<ProcessedEvent, 'id' | 'created_at' | 'updated_at'>): Promise<ProcessedEvent> {
    const { data, error } = await supabase
      .from('processed_events')
      .insert(eventData)
      .select(`
        *,
        category:event_categories(*),
        source:event_sources(*),
        scraped_event:scraped_events(*)
      `)
      .single();

    if (error) {
      console.error('Error creating processed event:', error);
      throw error;
    }

    return data;
  },

  // Atualizar status do evento processado
  async updateEventStatus(eventId: number, status: ProcessedEvent['status']): Promise<void> {
    const { error } = await supabase
      .from('processed_events')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);

    if (error) {
      console.error('Error updating event status:', error);
      throw error;
    }
  },

  // Invocar scraper
  async invokeScraper(url: string): Promise<any> {
    console.log(`🔍 Iniciando scraping para URL: ${url}`);
    
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.functions.invoke('event-scraper', {
        body: { url }
      });

      const duration = Date.now() - startTime;
      console.log(`⏱️ Scraping concluído em ${duration}ms`);

      if (error) {
        console.error('❌ Erro ao invocar scraper:', {
          error,
          url,
          duration,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Falha no scraping: ${error.message || 'Erro desconhecido'}`);
      }

      console.log(`✅ Scraping bem-sucedido:`, {
        eventsFound: data?.eventsScraped || 0,
        hasErrors: data?.errors?.length > 0,
        duration,
        url
      });

      return data;
    } catch (error) {
      console.error('❌ Erro crítico em invokeScraper:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        url,
        timestamp: new Date().toISOString()
      });
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido durante o scraping');
    }
  },

  // Salvar eventos coletados
  async saveScrapedEvents(events: ScrapedEvent[]): Promise<void> {
    console.log(`💾 Salvando ${events.length} eventos no banco de dados...`);
    
    try {
      const startTime = Date.now();
      
      // Validar dados antes de inserir
      const validEvents = events.filter(event => {
        if (!event.raw_title || !event.source_url) {
          console.warn('⚠️ Evento inválido ignorado:', {
            hasTitle: !!event.raw_title,
            hasUrl: !!event.source_url,
            event
          });
          return false;
        }
        return true;
      });
      
      if (validEvents.length === 0) {
        console.warn('⚠️ Nenhum evento válido para salvar');
        return;
      }
      
      const { error, data } = await supabase
        .from('scraped_events')
        .insert(validEvents)
        .select('id');

      const duration = Date.now() - startTime;

      if (error) {
        console.error('❌ Erro ao salvar eventos:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          eventsCount: validEvents.length,
          duration,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Falha ao salvar eventos: ${error.message}`);
      }

      console.log(`✅ Salvos ${validEvents.length} eventos com sucesso:`, {
        insertedIds: data?.map(d => d.id) || [],
        duration,
        skippedInvalid: events.length - validEvents.length
      });
    } catch (error) {
      console.error('❌ Erro crítico em saveScrapedEvents:', {
        error: error instanceof Error ? error.message : error,
        eventsCount: events.length,
        timestamp: new Date().toISOString()
      });
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido ao salvar eventos');
    }
  },

  // Marcar eventos como processados
  async markEventsAsProcessed(eventIds: number[]): Promise<void> {
    console.log(`🔄 Marcando ${eventIds.length} eventos como processados...`);
    
    try {
      const startTime = Date.now();
      
      if (eventIds.length === 0) {
        console.warn('⚠️ Nenhum ID de evento fornecido para marcar como processado');
        return;
      }
      
      const { error, data } = await supabase
         .from('scraped_events')
         .update({ 
           processed_at: new Date().toISOString(),
           processed: true
         })
         .in('id', eventIds)
         .select('id');

      const duration = Date.now() - startTime;

      if (error) {
        console.error('❌ Erro ao marcar eventos como processados:', {
          error: error.message,
          code: error.code,
          details: error.details,
          eventIds,
          duration,
          timestamp: new Date().toISOString()
        });
        throw new Error(`Falha ao marcar eventos como processados: ${error.message}`);
      }

      console.log(`✅ Marcados ${data?.length || eventIds.length} eventos como processados:`, {
         eventIds,
         duration,
         updatedCount: data?.length
       });
    } catch (error) {
      console.error('❌ Erro crítico em markEventsAsProcessed:', {
        error: error instanceof Error ? error.message : error,
        eventIds,
        timestamp: new Date().toISOString()
      });
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erro desconhecido ao marcar eventos como processados');
    }
  },

  // Gerenciamento de fontes de eventos
  async getEventSources(): Promise<EventSource[]> {
    const { data, error } = await supabase
      .from('event_sources')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching event sources:', error);
      throw error;
    }

    return data || [];
  },

  async createEventSource(sourceData: Omit<EventSource, 'id' | 'created_at' | 'updated_at'>): Promise<EventSource> {
    const { data, error } = await supabase
      .from('event_sources')
      .insert(sourceData)
      .select()
      .single();

    if (error) {
      console.error('Error creating event source:', error);
      throw error;
    }

    return data;
  },

  // Gerenciamento de categorias
  async getEventCategories(): Promise<EventCategory[]> {
    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching event categories:', error);
      throw error;
    }

    return data || [];
  },

  async createEventCategory(categoryData: Omit<EventCategory, 'id' | 'created_at' | 'updated_at'>): Promise<EventCategory> {
    const { data, error } = await supabase
      .from('event_categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      console.error('Error creating event category:', error);
      throw error;
    }

    return data;
  },

  // Buscar eventos por filtros
  async searchEvents(filters: {
    userId?: string;
    status?: ProcessedEvent['status'];
    categoryId?: number;
    sourceId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<ProcessedEvent[]> {
    let query = supabase
      .from('processed_events')
      .select(`
        *,
        category:event_categories(*),
        source:event_sources(*),
        scraped_event:scraped_events(*)
      `);

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

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

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 50);

    if (error) {
      console.error('Error searching events:', error);
      throw error;
    }

    return data || [];
  }
};

// Exportações individuais para compatibilidade
export const getUnprocessedEvents = scrapedEventsService.getUnprocessedEvents.bind(scrapedEventsService);
export const invokeScraper = scrapedEventsService.invokeScraper.bind(scrapedEventsService);
export const markEventsAsProcessed = scrapedEventsService.markEventsAsProcessed.bind(scrapedEventsService);
