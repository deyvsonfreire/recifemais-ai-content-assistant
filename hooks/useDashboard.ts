import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './useAppContext';
import { analyticsService } from '../services/analyticsService';
import { reportsService } from '../services/reportsService';
import { 
  UserActivitySummary, 
  DailyUsageStats, 
  FeaturePopularity,
  ErrorAnalysis,
  PerformanceSummary 
} from '../types';

interface DashboardMetrics {
  totalActions: number;
  totalApiCalls: number;
  totalErrors: number;
  totalSessions: number;
  avgResponseTime: number;
  recentActions: any[];
  recentErrors: any[];
}

interface DashboardData {
  metrics: DashboardMetrics | null;
  userActivity: UserActivitySummary[];
  dailyStats: DailyUsageStats[];
  featurePopularity: FeaturePopularity[];
  errorAnalysis: ErrorAnalysis[];
  performanceSummary: PerformanceSummary[];
}

export const useDashboard = () => {
  const { session } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    metrics: null,
    userActivity: [],
    dailyStats: [],
    featurePopularity: [],
    errorAnalysis: [],
    performanceSummary: []
  });
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  }>(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      from: sevenDaysAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  });
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Buscar métricas do dashboard
  const fetchDashboardMetrics = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      const metrics = await analyticsService.getDashboardMetrics(
        session.user.id, 
        dateRange.from, 
        dateRange.to
      );
      setDashboardData(prev => ({ ...prev, metrics }));
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    }
  }, [session?.user?.id, dateRange]);

  // Buscar dados de atividade do usuário
  const fetchUserActivity = useCallback(async (): Promise<void> => {
    if (!session?.user?.id) return;

    try {
      const userActivity = await reportsService.getUserActivitySummary(session.user.id);
      setDashboardData(prev => ({ ...prev, userActivity }));
    } catch (error) {
      console.error('Error fetching user activity:', error);
    }
  }, [session?.user?.id]);

  // Buscar estatísticas diárias
  const fetchDailyStats = useCallback(async (): Promise<void> => {
    try {
      const dailyStats = await reportsService.getDailyUsageStats(dateRange.from, dateRange.to);
      setDashboardData(prev => ({ ...prev, dailyStats }));
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    }
  }, [dateRange]);

  // Buscar popularidade de features
  const fetchFeaturePopularity = useCallback(async (): Promise<void> => {
    try {
      const featurePopularity = await reportsService.getFeaturePopularity();
      setDashboardData(prev => ({ ...prev, featurePopularity }));
    } catch (error) {
      console.error('Error fetching feature popularity:', error);
    }
  }, []);

  // Buscar análise de erros
  const fetchErrorAnalysis = useCallback(async (): Promise<void> => {
    try {
      const errorAnalysis = await reportsService.getErrorAnalysis(dateRange.from, dateRange.to);
      setDashboardData(prev => ({ ...prev, errorAnalysis }));
    } catch (error) {
      console.error('Error fetching error analysis:', error);
    }
  }, [dateRange]);

  // Buscar resumo de performance
  const fetchPerformanceSummary = useCallback(async (): Promise<void> => {
    try {
      const performanceSummary = await reportsService.getPerformanceSummary(dateRange.from, dateRange.to);
      setDashboardData(prev => ({ ...prev, performanceSummary }));
    } catch (error) {
      console.error('Error fetching performance summary:', error);
    }
  }, [dateRange]);

  // Carregar todos os dados do dashboard
  const loadDashboardData = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchDashboardMetrics(),
        fetchUserActivity(),
        fetchDailyStats(),
        fetchFeaturePopularity(),
        fetchErrorAnalysis(),
        fetchPerformanceSummary()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchDashboardMetrics,
    fetchUserActivity,
    fetchDailyStats,
    fetchFeaturePopularity,
    fetchErrorAnalysis,
    fetchPerformanceSummary
  ]);

  // Atualizar intervalo de datas
  const updateDateRange = useCallback((from: string, to: string): void => {
    setDateRange({ from, to });
  }, []);

  // Configurar atualização automática
  const startAutoRefresh = useCallback((intervalMs: number = 30000): void => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    const interval = setInterval(() => {
      loadDashboardData();
    }, intervalMs);
    
    setRefreshInterval(interval);
  }, [refreshInterval, loadDashboardData]);

  // Parar atualização automática
  const stopAutoRefresh = useCallback((): void => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [refreshInterval]);

  // Calcular KPIs
  const calculateKPIs = useCallback(() => {
    const { metrics, dailyStats, errorAnalysis } = dashboardData;
    
    if (!metrics || !dailyStats.length) {
      return {
        totalUsers: 0,
        avgSessionDuration: 0,
        errorRate: 0,
        growthRate: 0
      };
    }

    const totalUsers = dailyStats.reduce((sum, stat) => sum + stat.total_users, 0);
    const avgSessionDuration = dailyStats.reduce((sum, stat) => sum + stat.avg_session_duration, 0) / dailyStats.length;
    const totalErrors = errorAnalysis.reduce((sum, error) => sum + error.error_count, 0);
    const errorRate = metrics.totalApiCalls > 0 ? (totalErrors / metrics.totalApiCalls) * 100 : 0;
    
    // Calcular taxa de crescimento (comparando primeira e última semana)
    const firstWeekUsers = dailyStats.slice(0, 7).reduce((sum, stat) => sum + stat.total_users, 0);
    const lastWeekUsers = dailyStats.slice(-7).reduce((sum, stat) => sum + stat.total_users, 0);
    const growthRate = firstWeekUsers > 0 ? ((lastWeekUsers - firstWeekUsers) / firstWeekUsers) * 100 : 0;

    return {
      totalUsers,
      avgSessionDuration,
      errorRate,
      growthRate
    };
  }, [dashboardData]);

  // Carregar dados iniciais
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Limpar interval ao desmontar
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  return {
    isLoading,
    dashboardData,
    dateRange,
    refreshInterval: refreshInterval !== null,
    loadDashboardData,
    updateDateRange,
    startAutoRefresh,
    stopAutoRefresh,
    calculateKPIs
  };
};