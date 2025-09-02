import { useState, useEffect, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import { reportsService } from '../services/reportsService';
import { 
  UsageLog, 
  ApiUsageLog, 
  PerformanceMetric, 
  UserSession,
  ErrorLog 
} from '../types';
import { useAppContext } from './useAppContext';

export const useAnalytics = () => {
  const { session } = useAppContext();
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Iniciar sessão do usuário
  const startSession = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const userSession = await analyticsService.startUserSession(session.user.id);
      setCurrentSession(userSession);
      
      // Salvar ID da sessão no localStorage para persistência
      localStorage.setItem('current_session_id', userSession.id.toString());
    } catch (error) {
      console.error('Error starting session:', error);
    }
  }, [session?.user?.id]);

  // Finalizar sessão do usuário
  const endSession = useCallback(async () => {
    const sessionId = currentSession?.id || localStorage.getItem('current_session_id');
    if (!sessionId) return;

    try {
      await analyticsService.endUserSession(Number(sessionId));
      setCurrentSession(null);
      localStorage.removeItem('current_session_id');
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }, [currentSession?.id]);

  // Atualizar sessão (páginas visitadas, ações realizadas)
  const updateSession = useCallback(async (updates: { pages_visited?: number; actions_performed?: number }) => {
    const sessionId = currentSession?.id || localStorage.getItem('current_session_id');
    if (!sessionId) return;

    try {
      await analyticsService.updateUserSession(Number(sessionId), updates);
    } catch (error) {
      console.error('Error updating session:', error);
    }
  }, [currentSession?.id]);

  // Log de ação do usuário
  const logAction = useCallback(async (
    action: string, 
    resourceType?: string, 
    resourceId?: string, 
    metadata?: any
  ) => {
    if (!session?.user?.id) return;

    try {
      await analyticsService.logUserAction(session.user.id, action, resourceType, resourceId, metadata);
      
      // Incrementar contador de ações na sessão
      if (currentSession) {
        await updateSession({ actions_performed: (currentSession.actions_performed || 0) + 1 });
      }
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }, [session?.user?.id, currentSession, updateSession]);

  // Log de erro
  const logError = useCallback(async (
    errorType: string,
    errorMessage: string,
    stackTrace?: string,
    url?: string,
    metadata?: any
  ) => {
    try {
      await analyticsService.logError({
        user_id: session?.user?.id || null,
        error_type: errorType,
        error_message: errorMessage,
        stack_trace: stackTrace || null,
        url: url || window.location.href,
        user_agent: navigator.userAgent,
        metadata: metadata || {}
      });
    } catch (error) {
      console.error('Error logging error:', error);
    }
  }, [session?.user?.id]);

  // Registrar métrica de performance
  const recordMetric = useCallback(async (
    metricName: string,
    value: number,
    unit?: string,
    tags?: any
  ) => {
    try {
      await analyticsService.recordPerformanceMetric(metricName, value, unit, tags);
    } catch (error) {
      console.error('Error recording metric:', error);
    }
  }, []);

  // Buscar métricas do dashboard
  const getDashboardMetrics = useCallback(async (dateFrom?: string, dateTo?: string) => {
    if (!session?.user?.id) return null;

    setIsLoading(true);
    try {
      const metrics = await analyticsService.getDashboardMetrics(session.user.id, dateFrom, dateTo);
      return metrics;
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Buscar logs de uso do usuário
  const getUserLogs = useCallback(async (limit: number = 100) => {
    if (!session?.user?.id) return [];

    setIsLoading(true);
    try {
      const logs = await analyticsService.getUserUsageLogs(session.user.id, limit);
      return logs;
    } catch (error) {
      console.error('Error fetching user logs:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Buscar logs de erro
  const getErrorLogs = useCallback(async (errorType?: string, limit: number = 100) => {
    setIsLoading(true);
    try {
      const logs = await analyticsService.getErrorLogs(session?.user?.id, errorType, limit);
      return logs;
    } catch (error) {
      console.error('Error fetching error logs:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Inicializar sessão automaticamente quando o usuário faz login
  useEffect(() => {
    if (session?.user?.id && !currentSession) {
      // Verificar se já existe uma sessão ativa
      const existingSessionId = localStorage.getItem('current_session_id');
      if (existingSessionId) {
        setCurrentSession({ id: Number(existingSessionId) } as UserSession);
      } else {
        startSession();
      }
    }
  }, [session?.user?.id, currentSession, startSession]);

  // Finalizar sessão quando o usuário sai ou a página é fechada
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession?.id) {
        // Usar sendBeacon para garantir que a requisição seja enviada
        navigator.sendBeacon(
          '/api/analytics/end-session',
          JSON.stringify({ sessionId: currentSession.id })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentSession?.id]);

  return {
    currentSession,
    isLoading,
    startSession,
    endSession,
    updateSession,
    logAction,
    logError,
    recordMetric,
    getDashboardMetrics,
    getUserLogs,
    getErrorLogs
  };
};

// Hook para relatórios
export const useReports = () => {
  const { session } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const getUserActivitySummary = useCallback(async () => {
    if (!session?.user?.id) return [];

    setIsLoading(true);
    try {
      const summary = await reportsService.getUserActivitySummary(session.user.id);
      return summary;
    } catch (error) {
      console.error('Error fetching user activity summary:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const getDailyUsageStats = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsLoading(true);
    try {
      const stats = await reportsService.getDailyUsageStats(dateFrom, dateTo);
      return stats;
    } catch (error) {
      console.error('Error fetching daily usage stats:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFeaturePopularity = useCallback(async () => {
    setIsLoading(true);
    try {
      const popularity = await reportsService.getFeaturePopularity();
      return popularity;
    } catch (error) {
      console.error('Error fetching feature popularity:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUserUsageReport = useCallback(async (dateFrom?: string, dateTo?: string) => {
    if (!session?.user?.id) return null;

    setIsLoading(true);
    try {
      const report = await reportsService.getUserUsageReport(session.user.id, dateFrom, dateTo);
      return report;
    } catch (error) {
      console.error('Error fetching user usage report:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const getSystemReport = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsLoading(true);
    try {
      const report = await reportsService.getSystemReport(dateFrom, dateTo);
      return report;
    } catch (error) {
      console.error('Error fetching system report:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshMaterializedViews = useCallback(async () => {
    setIsLoading(true);
    try {
      await reportsService.refreshMaterializedViews();
      return true;
    } catch (error) {
      console.error('Error refreshing materialized views:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    getUserActivitySummary,
    getDailyUsageStats,
    getFeaturePopularity,
    getUserUsageReport,
    getSystemReport,
    refreshMaterializedViews
  };
};