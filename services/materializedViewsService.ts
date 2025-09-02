import { supabase } from './supabase';
import { analyticsService } from './analyticsService';

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
  refreshInterval: number; // em minutos
  dependencies: string[];
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
}

export const materializedViewsService = {
  // Configuração das views materializadas
  viewsConfig: new Map<string, ViewMetadata>([
    ['mv_user_activity_summary', {
      name: 'mv_user_activity_summary',
      description: 'Resumo de atividade dos usuários',
      refreshInterval: 60, // 1 hora
      dependencies: ['usage_logs', 'user_sessions'],
      priority: 'high',
      enabled: true
    }],
    ['mv_daily_usage_stats', {
      name: 'mv_daily_usage_stats',
      description: 'Estatísticas diárias de uso',
      refreshInterval: 30, // 30 minutos
      dependencies: ['usage_logs', 'api_usage_logs', 'user_sessions'],
      priority: 'high',
      enabled: true
    }],
    ['mv_feature_popularity', {
      name: 'mv_feature_popularity',
      description: 'Popularidade de features',
      refreshInterval: 120, // 2 horas
      dependencies: ['feature_usage_stats'],
      priority: 'medium',
      enabled: true
    }],
    ['mv_content_analytics', {
      name: 'mv_content_analytics',
      description: 'Analytics de conteúdo',
      refreshInterval: 180, // 3 horas
      dependencies: ['processed_events', 'usage_logs'],
      priority: 'medium',
      enabled: true
    }],
    ['mv_error_analysis', {
      name: 'mv_error_analysis',
      description: 'Análise de erros',
      refreshInterval: 15, // 15 minutos
      dependencies: ['error_logs'],
      priority: 'high',
      enabled: true
    }],
    ['mv_performance_summary', {
      name: 'mv_performance_summary',
      description: 'Resumo de performance',
      refreshInterval: 30, // 30 minutos
      dependencies: ['performance_metrics'],
      priority: 'high',
      enabled: true
    }]
  ]),

  // Status de refresh das views
  refreshStatus: new Map<string, ViewRefreshStatus>(),

  // Intervalos de refresh automático
  refreshIntervals: new Map<string, NodeJS.Timeout>(),

  // Refresh de uma view específica
  async refreshView(viewName: string, userId?: string): Promise<ViewRefreshStatus> {
    const config = this.viewsConfig.get(viewName);
    if (!config || !config.enabled) {
      throw new Error(`View ${viewName} not found or disabled`);
    }

    const startTime = Date.now();
    const status: ViewRefreshStatus = {
      viewName,
      lastRefresh: new Date(),
      status: 'in_progress'
    };

    this.refreshStatus.set(viewName, status);

    try {
      // Log início do refresh
      if (userId) {
        await analyticsService.logUserAction(
          userId,
          'refresh_materialized_view',
          'materialized_view',
          viewName
        );
      }

      // Executar refresh da view
      const { error } = await supabase.rpc('refresh_materialized_view', {
        view_name: viewName
      });

      if (error) {
        throw error;
      }

      const duration = Date.now() - startTime;
      status.status = 'success';
      status.duration = duration;

      // Log sucesso
      await analyticsService.recordPerformanceMetric(
        'materialized_view_refresh_duration',
        duration,
        'ms',
        { view_name: viewName }
      );

      console.log(`View ${viewName} refreshed successfully in ${duration}ms`);
      return status;

    } catch (error) {
      const duration = Date.now() - startTime;
      status.status = 'error';
      status.duration = duration;
      status.error = error instanceof Error ? error.message : String(error);

      // Log erro
      if (userId) {
        await analyticsService.logError({
          user_id: userId,
          error_type: 'materialized_view_refresh_error',
          error_message: `Failed to refresh view ${viewName}: ${status.error}`,
          stack_trace: error instanceof Error ? error.stack || null : null,
          url: null,
          user_agent: null,
          metadata: { view_name: viewName, duration }
        });
      }

      console.error(`Error refreshing view ${viewName}:`, error);
      throw error;
    } finally {
      this.refreshStatus.set(viewName, status);
    }
  },

  // Refresh de múltiplas views em ordem de prioridade
  async refreshMultipleViews(viewNames: string[], userId?: string): Promise<ViewRefreshStatus[]> {
    const results: ViewRefreshStatus[] = [];
    
    // Ordenar por prioridade
    const sortedViews = viewNames
      .map(name => ({ name, config: this.viewsConfig.get(name) }))
      .filter(item => item.config && item.config.enabled)
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.config!.priority] - priorityOrder[a.config!.priority];
      })
      .map(item => item.name);

    for (const viewName of sortedViews) {
      try {
        const result = await this.refreshView(viewName, userId);
        results.push(result);
      } catch (error) {
        // Continuar com as próximas views mesmo se uma falhar
        console.error(`Failed to refresh view ${viewName}, continuing with others`);
      }
    }

    return results;
  },

  // Refresh de todas as views
  async refreshAllViews(userId?: string): Promise<ViewRefreshStatus[]> {
    const enabledViews = Array.from(this.viewsConfig.keys())
      .filter(name => this.viewsConfig.get(name)?.enabled);
    
    return this.refreshMultipleViews(enabledViews, userId);
  },

  // Configurar refresh automático
  startAutoRefresh(): void {
    this.viewsConfig.forEach((config, viewName) => {
      if (!config.enabled) return;

      // Limpar interval existente se houver
      const existingInterval = this.refreshIntervals.get(viewName);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      // Configurar novo interval
      const interval = setInterval(async () => {
        try {
          await this.refreshView(viewName);
        } catch (error) {
          console.error(`Auto-refresh failed for view ${viewName}:`, error);
        }
      }, config.refreshInterval * 60 * 1000); // Converter minutos para ms

      this.refreshIntervals.set(viewName, interval);
      console.log(`Auto-refresh configured for ${viewName} every ${config.refreshInterval} minutes`);
    });
  },

  // Parar refresh automático
  stopAutoRefresh(viewName?: string): void {
    if (viewName) {
      const interval = this.refreshIntervals.get(viewName);
      if (interval) {
        clearInterval(interval);
        this.refreshIntervals.delete(viewName);
        console.log(`Auto-refresh stopped for ${viewName}`);
      }
    } else {
      // Parar todos os intervals
      this.refreshIntervals.forEach((interval, name) => {
        clearInterval(interval);
        console.log(`Auto-refresh stopped for ${name}`);
      });
      this.refreshIntervals.clear();
    }
  },

  // Obter status de refresh
  getRefreshStatus(viewName?: string): ViewRefreshStatus | ViewRefreshStatus[] {
    if (viewName) {
      return this.refreshStatus.get(viewName) || {
        viewName,
        lastRefresh: new Date(0),
        status: 'success'
      };
    }
    
    return Array.from(this.refreshStatus.values());
  },

  // Obter configuração das views
  getViewsConfig(): ViewMetadata[] {
    return Array.from(this.viewsConfig.values());
  },

  // Atualizar configuração de uma view
  updateViewConfig(viewName: string, updates: Partial<ViewMetadata>): void {
    const config = this.viewsConfig.get(viewName);
    if (!config) {
      throw new Error(`View ${viewName} not found`);
    }

    const updatedConfig = { ...config, ...updates };
    this.viewsConfig.set(viewName, updatedConfig);

    // Reconfigurar auto-refresh se necessário
    if (updates.refreshInterval || updates.enabled !== undefined) {
      this.stopAutoRefresh(viewName);
      if (updatedConfig.enabled) {
        this.startAutoRefresh();
      }
    }
  },

  // Verificar dependências de uma view
  async checkViewDependencies(viewName: string): Promise<{ [table: string]: boolean }> {
    const config = this.viewsConfig.get(viewName);
    if (!config) {
      throw new Error(`View ${viewName} not found`);
    }

    const dependencyStatus: { [table: string]: boolean } = {};

    for (const table of config.dependencies) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        dependencyStatus[table] = !error;
      } catch {
        dependencyStatus[table] = false;
      }
    }

    return dependencyStatus;
  },

  // Obter estatísticas de performance das views
  async getViewPerformanceStats(viewName?: string, days: number = 7): Promise<any> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    let query = supabase
      .from('performance_metrics')
      .select('*')
      .eq('metric_name', 'materialized_view_refresh_duration')
      .gte('created_at', dateFrom.toISOString());

    if (viewName) {
      query = query.eq('tags->view_name', viewName);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching view performance stats:', error);
      throw error;
    }

    // Calcular estatísticas
    const stats = data?.reduce((acc, metric) => {
      const viewName = metric.tags?.view_name || 'unknown';
      if (!acc[viewName]) {
        acc[viewName] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          avgDuration: 0
        };
      }

      acc[viewName].count++;
      acc[viewName].totalDuration += metric.metric_value;
      acc[viewName].minDuration = Math.min(acc[viewName].minDuration, metric.metric_value);
      acc[viewName].maxDuration = Math.max(acc[viewName].maxDuration, metric.metric_value);
      acc[viewName].avgDuration = acc[viewName].totalDuration / acc[viewName].count;

      return acc;
    }, {} as any) || {};

    return stats;
  },

  // Limpar cache e forçar refresh
  async forceClearAndRefresh(viewName: string, userId?: string): Promise<ViewRefreshStatus> {
    try {
      // Primeiro, tentar limpar o cache da view (se suportado)
      try {
        await supabase.rpc('clear_materialized_view_cache', {
          view_name: viewName
        });
      } catch {
        // Ignorar erro se a função não existir
        console.log(`Cache clear not supported for ${viewName}`);
      }

      // Depois, fazer o refresh
      return await this.refreshView(viewName, userId);
    } catch (error) {
      console.error(`Error in force clear and refresh for ${viewName}:`, error);
      throw error;
    }
  }
};