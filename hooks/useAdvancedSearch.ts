import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppContext } from './useAppContext';
import { analyticsService } from '../services/analyticsService';
import { supabase } from '../services/supabase';

// Tipos para busca avançada
interface SearchFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'not_in' | 'is' | 'not_is';
  value: any;
  type?: 'string' | 'number' | 'date' | 'boolean' | 'array';
}

interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
}

interface SearchOptions {
  query?: string;
  filters?: SearchFilter[];
  sort?: SearchSort[];
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  highlight?: boolean;
  facets?: string[];
  boost?: { [field: string]: number };
}

interface SearchResult<T = any> {
  items: T[];
  total: number;
  facets?: { [field: string]: { [value: string]: number } };
  suggestions?: string[];
  took: number;
  page: number;
  totalPages: number;
}

interface SearchHistory {
  id: string;
  query: string;
  filters: SearchFilter[];
  timestamp: Date;
  resultCount: number;
  executionTime: number;
}

interface SearchStats {
  totalSearches: number;
  averageExecutionTime: number;
  popularQueries: { query: string; count: number }[];
  popularFilters: { field: string; count: number }[];
  noResultQueries: string[];
  searchTrends: { date: string; count: number }[];
}

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  options: SearchOptions;
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}

export const useAdvancedSearch = <T = any>(tableName: string) => {
  const { session } = useAppContext();
  const [results, setResults] = useState<SearchResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const searchCache = useRef<Map<string, SearchResult<T>>>(new Map());
  const abortController = useRef<AbortController | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Função principal de busca
  const search = useCallback(async (options: SearchOptions): Promise<SearchResult<T>> => {
    try {
      setIsLoading(true);
      setError(null);

      // Cancelar busca anterior se existir
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      const startTime = Date.now();
      const cacheKey = JSON.stringify(options);

      // Verificar cache
      if (searchCache.current.has(cacheKey)) {
        const cachedResult = searchCache.current.get(cacheKey)!;
        setResults(cachedResult);
        return cachedResult;
      }

      // Construir query
      let query = supabase.from(tableName).select('*', { count: 'exact' });

      // Aplicar filtros de texto
      if (options.query) {
        if (options.fuzzy) {
          // Busca fuzzy usando ilike com wildcards
          const fuzzyQuery = options.query.split(' ').map(term => `%${term}%`).join('');
          query = query.or(`title.ilike.${fuzzyQuery},description.ilike.${fuzzyQuery},content.ilike.${fuzzyQuery}`);
        } else {
          // Busca exata
          query = query.textSearch('fts', options.query);
        }
      }

      // Aplicar filtros
      if (options.filters) {
        options.filters.forEach(filter => {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.field, filter.value);
              break;
            case 'neq':
              query = query.neq(filter.field, filter.value);
              break;
            case 'gt':
              query = query.gt(filter.field, filter.value);
              break;
            case 'gte':
              query = query.gte(filter.field, filter.value);
              break;
            case 'lt':
              query = query.lt(filter.field, filter.value);
              break;
            case 'lte':
              query = query.lte(filter.field, filter.value);
              break;
            case 'like':
              query = query.like(filter.field, filter.value);
              break;
            case 'ilike':
              query = query.ilike(filter.field, filter.value);
              break;
            case 'in':
              query = query.in(filter.field, filter.value);
              break;
            case 'not_in':
              query = query.not(filter.field, 'in', filter.value);
              break;
            case 'is':
              query = query.is(filter.field, filter.value);
              break;
            case 'not_is':
              query = query.not(filter.field, 'is', filter.value);
              break;
          }
        });
      }

      // Aplicar ordenação
      if (options.sort) {
        options.sort.forEach(sort => {
          query = query.order(sort.field, { ascending: sort.direction === 'asc' });
        });
      }

      // Aplicar paginação
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
      }

      // Executar query
      const { data, error: queryError, count } = await query;

      if (queryError) {
        throw queryError;
      }

      const executionTime = Date.now() - startTime;
      const page = Math.floor((options.offset || 0) / (options.limit || 10)) + 1;
      const totalPages = Math.ceil((count || 0) / (options.limit || 10));

      // Processar facetas se solicitado
      let facets: { [field: string]: { [value: string]: number } } | undefined;
      if (options.facets && options.facets.length > 0) {
        facets = await calculateFacets(options.facets, options.filters || []);
      }

      // Gerar sugestões se não houver resultados
      let suggestions: string[] | undefined;
      if (data && data.length === 0 && options.query) {
        suggestions = await generateSuggestions(options.query);
      }

      const result: SearchResult<T> = {
        items: data as T[],
        total: count || 0,
        facets,
        suggestions,
        took: executionTime,
        page,
        totalPages
      };

      // Armazenar no cache
      searchCache.current.set(cacheKey, result);
      if (searchCache.current.size > 100) {
        const firstKey = searchCache.current.keys().next().value;
        searchCache.current.delete(firstKey);
      }

      // Adicionar ao histórico
      const historyEntry: SearchHistory = {
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: options.query || '',
        filters: options.filters || [],
        timestamp: new Date(),
        resultCount: count || 0,
        executionTime
      };
      setSearchHistory(prev => [historyEntry, ...prev.slice(0, 49)]);

      // Log da ação
      if (session?.user) {
        analyticsService.logUserAction(
          session.user.id,
          'advanced_search_executed',
          'search',
          historyEntry.id,
          {
            table: tableName,
            query: options.query,
            filterCount: options.filters?.length || 0,
            resultCount: count || 0,
            executionTime
          }
        );
      }

      setResults(result);
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return results || { items: [], total: 0, took: 0, page: 1, totalPages: 0 };
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro na busca';
      setError(errorMessage);
      
      if (session?.user) {
        analyticsService.logError({
          user_id: session.user.id,
          error_type: 'search_error',
          error_message: errorMessage,
          severity: 'medium',
          stack_trace: null,
          url: null,
          user_agent: null,
          metadata: { table: tableName, options }
        });
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [tableName, session, results]);

  // Função para busca com debounce
  const searchWithDebounce = useCallback((options: SearchOptions, delay: number = 300): void => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      search(options);
    }, delay);
  }, [search]);

  // Função para calcular facetas
  const calculateFacets = useCallback(async (facetFields: string[], filters: SearchFilter[]): Promise<{ [field: string]: { [value: string]: number } }> => {
    const facets: { [field: string]: { [value: string]: number } } = {};

    for (const field of facetFields) {
      try {
        let query = supabase.from(tableName).select(field);
        
        // Aplicar filtros existentes (exceto para o campo atual)
        filters.filter(f => f.field !== field).forEach(filter => {
          switch (filter.operator) {
            case 'eq':
              query = query.eq(filter.field, filter.value);
              break;
            // Adicionar outros operadores conforme necessário
          }
        });

        const { data } = await query;
        
        if (data) {
          const counts: { [value: string]: number } = {};
          data.forEach(item => {
            const value = item[field];
            if (value !== null && value !== undefined) {
              const key = String(value);
              counts[key] = (counts[key] || 0) + 1;
            }
          });
          facets[field] = counts;
        }
      } catch (err) {
        console.error(`Erro ao calcular faceta para ${field}:`, err);
      }
    }

    return facets;
  }, [tableName]);

  // Função para gerar sugestões
  const generateSuggestions = useCallback(async (query: string): Promise<string[]> => {
    try {
      // Buscar termos similares no histórico
      const historySuggestions = searchHistory
        .filter(h => h.query.toLowerCase().includes(query.toLowerCase()) && h.resultCount > 0)
        .map(h => h.query)
        .slice(0, 3);

      // Buscar termos populares
      const popularSuggestions = await getPopularQueries();
      const filteredPopular = popularSuggestions
        .filter(p => p.query.toLowerCase().includes(query.toLowerCase()))
        .map(p => p.query)
        .slice(0, 2);

      return [...new Set([...historySuggestions, ...filteredPopular])];
    } catch (err) {
      console.error('Erro ao gerar sugestões:', err);
      return [];
    }
  }, [searchHistory]);

  // Função para salvar busca
  const saveSearch = useCallback(async (name: string, description: string, options: SearchOptions): Promise<string> => {
    try {
      const savedSearch: SavedSearch = {
        id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        options,
        createdAt: new Date(),
        useCount: 0
      };

      setSavedSearches(prev => [savedSearch, ...prev]);

      // Salvar no localStorage
      const allSaved = [savedSearch, ...savedSearches];
      localStorage.setItem(`saved_searches_${tableName}`, JSON.stringify(allSaved));

      // Log da ação
      if (session?.user) {
        analyticsService.logUserAction(
          session.user.id,
          'search_saved',
          'search',
          savedSearch.id,
          { name, table: tableName }
        );
      }

      return savedSearch.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar busca';
      setError(errorMessage);
      throw err;
    }
  }, [savedSearches, tableName, session]);

  // Função para executar busca salva
  const executeSavedSearch = useCallback(async (savedSearchId: string): Promise<SearchResult<T>> => {
    const savedSearch = savedSearches.find(s => s.id === savedSearchId);
    if (!savedSearch) {
      throw new Error('Busca salva não encontrada');
    }

    // Atualizar contador de uso
    setSavedSearches(prev => 
      prev.map(s => 
        s.id === savedSearchId 
          ? { ...s, useCount: s.useCount + 1, lastUsed: new Date() }
          : s
      )
    );

    return search(savedSearch.options);
  }, [savedSearches, search]);

  // Função para obter queries populares
  const getPopularQueries = useCallback(async (): Promise<{ query: string; count: number }[]> => {
    const queryCount: { [query: string]: number } = {};
    
    searchHistory.forEach(h => {
      if (h.query && h.resultCount > 0) {
        queryCount[h.query] = (queryCount[h.query] || 0) + 1;
      }
    });

    return Object.entries(queryCount)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [searchHistory]);

  // Função para obter estatísticas
  const getStats = useCallback((): SearchStats => {
    const totalSearches = searchHistory.length;
    const averageExecutionTime = searchHistory.reduce((sum, h) => sum + h.executionTime, 0) / totalSearches || 0;
    
    const queryCount: { [query: string]: number } = {};
    const filterCount: { [field: string]: number } = {};
    const noResultQueries: string[] = [];
    const dailyCount: { [date: string]: number } = {};

    searchHistory.forEach(h => {
      // Queries populares
      if (h.query) {
        queryCount[h.query] = (queryCount[h.query] || 0) + 1;
        if (h.resultCount === 0) {
          noResultQueries.push(h.query);
        }
      }

      // Filtros populares
      h.filters.forEach(f => {
        filterCount[f.field] = (filterCount[f.field] || 0) + 1;
      });

      // Tendências diárias
      const date = h.timestamp.toISOString().split('T')[0];
      dailyCount[date] = (dailyCount[date] || 0) + 1;
    });

    return {
      totalSearches,
      averageExecutionTime,
      popularQueries: Object.entries(queryCount)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      popularFilters: Object.entries(filterCount)
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      noResultQueries: [...new Set(noResultQueries)],
      searchTrends: Object.entries(dailyCount)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }, [searchHistory]);

  // Função para limpar cache
  const clearCache = useCallback((): void => {
    searchCache.current.clear();
  }, []);

  // Carregar buscas salvas do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`saved_searches_${tableName}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedSearches(parsed);
      } catch (err) {
        console.error('Erro ao carregar buscas salvas:', err);
      }
    }
  }, [tableName]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  // Computed values
  const hasResults = useMemo(() => results && results.items.length > 0, [results]);
  const isEmpty = useMemo(() => results && results.items.length === 0, [results]);
  const totalPages = useMemo(() => results?.totalPages || 0, [results]);
  const currentPage = useMemo(() => results?.page || 1, [results]);

  return {
    // Estado
    results,
    isLoading,
    error,
    searchHistory,
    savedSearches,
    suggestions,

    // Funções principais
    search,
    searchWithDebounce,
    saveSearch,
    executeSavedSearch,

    // Funções de utilidade
    getStats,
    getPopularQueries,
    clearCache,
    generateSuggestions,

    // Computed values
    hasResults,
    isEmpty,
    totalPages,
    currentPage,
    totalResults: results?.total || 0,
    executionTime: results?.took || 0
  };
};

export default useAdvancedSearch;