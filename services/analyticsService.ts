import { supabase } from './supabase';
import { 
  UsageLog, 
  ApiUsageLog, 
  PerformanceMetric, 
  FeatureUsageStats, 
  UserSession, 
  ErrorLog 
} from '../types';

export const analyticsService = {
  // Logs de uso
  async logUserAction(userId: string, action: string, resourceType?: string, resourceId?: string, metadata?: any): Promise<void> {
    const { error } = await supabase
      .from('usage_logs')
      .insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata: metadata || {}
      });

    if (error) {
      console.error('Error logging user action:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  },

  async getUserUsageLogs(userId: string, limit: number = 100): Promise<UsageLog[]> {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user usage logs:', error);
      throw error;
    }

    return data || [];
  },

  // Logs de API
  async logApiUsage(data: Omit<ApiUsageLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('api_usage_logs')
      .insert(data);

    if (error) {
      console.error('Error logging API usage:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  },

  async getApiUsageStats(dateFrom?: string, dateTo?: string): Promise<ApiUsageLog[]> {
    let query = supabase
      .from('api_usage_logs')
      .select('*');

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching API usage stats:', error);
      throw error;
    }

    return data || [];
  },

  // Métricas de performance
  async recordPerformanceMetric(metricName: string, value: number, unit?: string, tags?: any): Promise<void> {
    const { error } = await supabase
      .from('performance_metrics')
      .insert({
        metric_name: metricName,
        metric_value: value,
        unit,
        tags: tags || {}
      });

    if (error) {
      console.error('Error recording performance metric:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  },

  async getPerformanceMetrics(metricName?: string, dateFrom?: string, dateTo?: string): Promise<PerformanceMetric[]> {
    let query = supabase
      .from('performance_metrics')
      .select('*');

    if (metricName) {
      query = query.eq('metric_name', metricName);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching performance metrics:', error);
      throw error;
    }

    return data || [];
  },

  // Estatísticas de uso de features
  async getFeatureUsageStats(dateFrom?: string, dateTo?: string): Promise<FeatureUsageStats[]> {
    let query = supabase
      .from('feature_usage_stats')
      .select('*');

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data, error } = await query
      .order('date', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching feature usage stats:', error);
      throw error;
    }

    return data || [];
  },

  // Sessões de usuário
  async startUserSession(userId: string): Promise<UserSession> {
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_start: new Date().toISOString(),
        pages_visited: 1,
        actions_performed: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting user session:', error);
      throw error;
    }

    return data;
  },

  async updateUserSession(sessionId: number, updates: Partial<Pick<UserSession, 'pages_visited' | 'actions_performed'>>): Promise<void> {
    const { error } = await supabase
      .from('user_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating user session:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  },

  async endUserSession(sessionId: number): Promise<void> {
    const sessionEnd = new Date().toISOString();
    
    // Buscar dados da sessão para calcular duração
    const { data: session } = await supabase
      .from('user_sessions')
      .select('session_start')
      .eq('id', sessionId)
      .single();

    let durationMinutes = null;
    if (session) {
      const start = new Date(session.session_start);
      const end = new Date(sessionEnd);
      durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    const { error } = await supabase
      .from('user_sessions')
      .update({
        session_end: sessionEnd,
        duration_minutes: durationMinutes
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error ending user session:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  },

  // Logs de erro
  async logError(errorData: Omit<ErrorLog, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase
      .from('error_logs')
      .insert(errorData);

    if (error) {
      console.error('Error logging error:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  },

  async getErrorLogs(userId?: string, errorType?: string, limit: number = 100): Promise<ErrorLog[]> {
    let query = supabase
      .from('error_logs')
      .select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (errorType) {
      query = query.eq('error_type', errorType);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching error logs:', error);
      throw error;
    }

    return data || [];
  },

  // Métricas agregadas
  async getDashboardMetrics(userId?: string, dateFrom?: string, dateTo?: string) {
    try {
      const [usageLogs, apiLogs, errorLogs, sessions] = await Promise.all([
        this.getUserUsageLogs(userId || '', 50),
        this.getApiUsageStats(dateFrom, dateTo),
        this.getErrorLogs(userId, undefined, 20),
        userId ? supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
          .then(({ data }) => data || [])
        : Promise.resolve([])
      ]);

      return {
        totalActions: usageLogs.length,
        totalApiCalls: apiLogs.length,
        totalErrors: errorLogs.length,
        totalSessions: sessions.length,
        recentActions: usageLogs.slice(0, 10),
        recentErrors: errorLogs.slice(0, 5),
        avgResponseTime: apiLogs.length > 0 
          ? apiLogs.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / apiLogs.length
          : 0
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }
};