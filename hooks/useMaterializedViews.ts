import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './useAppContext';
import { materializedViewsService } from '../services/materializedViewsService';
import { reportsService } from '../services/reportsService';

interface ViewRefreshStatus {
  viewName: string;
  lastRefresh: Date;
  status: 'success' | 'error' | 'in_progress';
  duration?: number;
  error?: string;
}

interface ViewMetadata {
  name: string;
  description: string;
  refreshInterval: number;
  dependencies: string[];
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
}

export const useMaterializedViews = () => {
  const { session } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshStatuses, setRefreshStatuses] = useState<ViewRefreshStatus[]>([]);
  const [viewsConfig, setViewsConfig] = useState<ViewMetadata[]>([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<any>({});

  // Carregar configuração das views
  const loadViewsConfig = useCallback((): void => {
    const config = materializedViewsService.getViewsConfig();
    setViewsConfig(config);
  }, []);

  // Carregar status de refresh
  const loadRefreshStatuses = useCallback((): void => {
    const statuses = materializedViewsService.getRefreshStatus() as ViewRefreshStatus[];
    setRefreshStatuses(statuses);
  }, []);

  // Refresh de uma view específica
  const refreshView = useCallback(async (viewName: string): Promise<void> => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      await materializedViewsService.refreshView(viewName, session.user.id);
      loadRefreshStatuses();
    } catch (error) {
      console.error(`Error refreshing view ${viewName}:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, loadRefreshStatuses]);

  // Refresh de múltiplas views
  const refreshMultipleViews = useCallback(async (viewNames: string[]): Promise<void> => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      await materializedViewsService.refreshMultipleViews(viewNames, session.user.id);
      loadRefreshStatuses();
    } catch (error) {
      console.error('Error refreshing multiple views:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, loadRefreshStatuses]);

  // Refresh de todas as views
  const refreshAllViews = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      await materializedViewsService.refreshAllViews(session.user.id);
      loadRefreshStatuses();
    } catch (error) {
      console.error('Error refreshing all views:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, loadRefreshStatuses]);

  // Iniciar refresh automático
  const startAutoRefresh = useCallback((): void => {
    materializedViewsService.startAutoRefresh();
    setAutoRefreshEnabled(true);
  }, []);

  // Parar refresh automático
  const stopAutoRefresh = useCallback((viewName?: string): void => {
    materializedViewsService.stopAutoRefresh(viewName);
    if (!viewName) {
      setAutoRefreshEnabled(false);
    }
  }, []);

  // Atualizar configuração de uma view
  const updateViewConfig = useCallback((viewName: string, updates: Partial<ViewMetadata>): void => {
    materializedViewsService.updateViewConfig(viewName, updates);
    loadViewsConfig();
  }, [loadViewsConfig]);

  // Verificar dependências de uma view
  const checkViewDependencies = useCallback(async (viewName: string): Promise<{ [table: string]: boolean }> => {
    try {
      return await materializedViewsService.checkViewDependencies(viewName);
    } catch (error) {
      console.error(`Error checking dependencies for ${viewName}:`, error);
      throw error;
    }
  }, []);

  // Carregar estatísticas de performance
  const loadPerformanceStats = useCallback(async (viewName?: string, days: number = 7): Promise<void> => {
    try {
      const stats = await materializedViewsService.getViewPerformanceStats(viewName, days);
      setPerformanceStats(stats);
    } catch (error) {
      console.error('Error loading performance stats:', error);
    }
  }, []);

  // Forçar limpeza e refresh
  const forceClearAndRefresh = useCallback(async (viewName: string): Promise<void> => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      await materializedViewsService.forceClearAndRefresh(viewName, session.user.id);
      loadRefreshStatuses();
    } catch (error) {
      console.error(`Error in force clear and refresh for ${viewName}:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, loadRefreshStatuses]);

  // Obter views por prioridade
  const getViewsByPriority = useCallback((priority: 'high' | 'medium' | 'low'): ViewMetadata[] => {
    return viewsConfig.filter(view => view.priority === priority);
  }, [viewsConfig]);

  // Obter views habilitadas
  const getEnabledViews = useCallback((): ViewMetadata[] => {
    return viewsConfig.filter(view => view.enabled);
  }, [viewsConfig]);

  // Obter status de uma view específica
  const getViewStatus = useCallback((viewName: string): ViewRefreshStatus | undefined => {
    return refreshStatuses.find(status => status.viewName === viewName);
  }, [refreshStatuses]);

  // Obter views com erro
  const getViewsWithErrors = useCallback((): ViewRefreshStatus[] => {
    return refreshStatuses.filter(status => status.status === 'error');
  }, [refreshStatuses]);

  // Obter views em progresso
  const getViewsInProgress = useCallback((): ViewRefreshStatus[] => {
    return refreshStatuses.filter(status => status.status === 'in_progress');
  }, [refreshStatuses]);

  // Calcular tempo médio de refresh
  const getAverageRefreshTime = useCallback((viewName?: string): number => {
    const relevantStatuses = viewName 
      ? refreshStatuses.filter(status => status.viewName === viewName)
      : refreshStatuses;
    
    const statusesWithDuration = relevantStatuses.filter(status => 
      status.duration && status.status === 'success'
    );
    
    if (statusesWithDuration.length === 0) return 0;
    
    const totalDuration = statusesWithDuration.reduce((sum, status) => 
      sum + (status.duration || 0), 0
    );
    
    return totalDuration / statusesWithDuration.length;
  }, [refreshStatuses]);

  // Verificar se uma view precisa de refresh
  const needsRefresh = useCallback((viewName: string, thresholdMinutes: number = 60): boolean => {
    const status = getViewStatus(viewName);
    const config = viewsConfig.find(view => view.name === viewName);
    
    if (!status || !config) return true;
    
    const timeSinceLastRefresh = Date.now() - status.lastRefresh.getTime();
    const thresholdMs = Math.min(thresholdMinutes, config.refreshInterval) * 60 * 1000;
    
    return timeSinceLastRefresh > thresholdMs;
  }, [getViewStatus, viewsConfig]);

  // Refresh inteligente (apenas views que precisam)
  const smartRefresh = useCallback(async (): Promise<void> => {
    const viewsToRefresh = viewsConfig
      .filter(view => view.enabled && needsRefresh(view.name))
      .map(view => view.name);
    
    if (viewsToRefresh.length > 0) {
      await refreshMultipleViews(viewsToRefresh);
    }
  }, [viewsConfig, needsRefresh, refreshMultipleViews]);

  // Carregar dados iniciais
  useEffect(() => {
    loadViewsConfig();
    loadRefreshStatuses();
    loadPerformanceStats();
  }, [loadViewsConfig, loadRefreshStatuses, loadPerformanceStats]);

  // Atualizar status periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      loadRefreshStatuses();
    }, 30000); // A cada 30 segundos

    return () => clearInterval(interval);
  }, [loadRefreshStatuses]);

  return {
    isLoading,
    refreshStatuses,
    viewsConfig,
    autoRefreshEnabled,
    performanceStats,
    refreshView,
    refreshMultipleViews,
    refreshAllViews,
    startAutoRefresh,
    stopAutoRefresh,
    updateViewConfig,
    checkViewDependencies,
    loadPerformanceStats,
    forceClearAndRefresh,
    getViewsByPriority,
    getEnabledViews,
    getViewStatus,
    getViewsWithErrors,
    getViewsInProgress,
    getAverageRefreshTime,
    needsRefresh,
    smartRefresh
  };
};