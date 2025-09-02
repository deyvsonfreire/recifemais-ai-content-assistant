import { supabase } from './supabase';
import { 
  UserActivitySummary, 
  DailyUsageStats, 
  FeaturePopularity, 
  ContentAnalytics, 
  ErrorAnalysis, 
  PerformanceSummary 
} from '../types';

export const reportsService = {
  // Views materializadas - Resumo de atividade do usuário
  async getUserActivitySummary(userId?: string): Promise<UserActivitySummary[]> {
    let query = supabase
      .from('mv_user_activity_summary')
      .select('*');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query
      .order('total_actions', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching user activity summary:', error);
      throw error;
    }

    return data || [];
  },

  // Estatísticas diárias de uso
  async getDailyUsageStats(dateFrom?: string, dateTo?: string): Promise<DailyUsageStats[]> {
    let query = supabase
      .from('mv_daily_usage_stats')
      .select('*');

    if (dateFrom) {
      query = query.gte('date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('date', dateTo);
    }

    const { data, error } = await query
      .order('date', { ascending: false })
      .limit(90); // Últimos 90 dias

    if (error) {
      console.error('Error fetching daily usage stats:', error);
      throw error;
    }

    return data || [];
  },

  // Popularidade de features
  async getFeaturePopularity(): Promise<FeaturePopularity[]> {
    const { data, error } = await supabase
      .from('mv_feature_popularity')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching feature popularity:', error);
      throw error;
    }

    return data || [];
  },

  // Relatórios customizados usando SQL
  async getContentAnalytics(userId?: string, dateFrom?: string, dateTo?: string): Promise<ContentAnalytics[]> {
    let query = `
      SELECT 
        'articles' as content_type,
        COUNT(*) as total_created,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as total_published,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60) as avg_creation_time
      FROM processed_events 
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ' GROUP BY content_type';

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params
    });

    if (error) {
      console.error('Error fetching content analytics:', error);
      throw error;
    }

    return data || [];
  },

  // Análise de erros
  async getErrorAnalysis(dateFrom?: string, dateTo?: string): Promise<ErrorAnalysis[]> {
    let query = `
      SELECT 
        error_type,
        COUNT(*) as error_count,
        COUNT(DISTINCT user_id) as affected_users,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM error_logs 
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ' GROUP BY error_type ORDER BY error_count DESC';

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params
    });

    if (error) {
      console.error('Error fetching error analysis:', error);
      throw error;
    }

    return data || [];
  },

  // Resumo de performance
  async getPerformanceSummary(metricName?: string, dateFrom?: string, dateTo?: string): Promise<PerformanceSummary[]> {
    let query = `
      SELECT 
        metric_name,
        AVG(metric_value) as avg_value,
        MIN(metric_value) as min_value,
        MAX(metric_value) as max_value,
        COUNT(*) as sample_count
      FROM performance_metrics 
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (metricName) {
      query += ` AND metric_name = $${paramIndex}`;
      params.push(metricName);
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ' GROUP BY metric_name ORDER BY avg_value DESC';

    const { data, error } = await supabase.rpc('execute_sql', {
      query,
      params
    });

    if (error) {
      console.error('Error fetching performance summary:', error);
      throw error;
    }

    return data || [];
  },

  // Relatório de uso por usuário
  async getUserUsageReport(userId: string, dateFrom?: string, dateTo?: string) {
    try {
      const [activitySummary, dailyStats, contentStats] = await Promise.all([
        this.getUserActivitySummary(userId),
        this.getDailyUsageStats(dateFrom, dateTo),
        this.getContentAnalytics(userId, dateFrom, dateTo)
      ]);

      // Buscar dados adicionais do usuário
      const { data: userSessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: recentActions } = await supabase
        .from('usage_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      return {
        user_id: userId,
        activity_summary: activitySummary[0] || null,
        daily_stats: dailyStats,
        content_stats: contentStats,
        recent_sessions: userSessions || [],
        recent_actions: recentActions || [],
        total_sessions: userSessions?.length || 0,
        avg_session_duration: userSessions?.length > 0 
          ? userSessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0) / userSessions.length
          : 0
      };
    } catch (error) {
      console.error('Error generating user usage report:', error);
      throw error;
    }
  },

  // Relatório geral do sistema
  async getSystemReport(dateFrom?: string, dateTo?: string) {
    try {
      const [dailyStats, featurePopularity, errorAnalysis, performanceSummary] = await Promise.all([
        this.getDailyUsageStats(dateFrom, dateTo),
        this.getFeaturePopularity(),
        this.getErrorAnalysis(dateFrom, dateTo),
        this.getPerformanceSummary(undefined, dateFrom, dateTo)
      ]);

      // Calcular métricas agregadas
      const totalUsers = dailyStats.reduce((sum, day) => Math.max(sum, day.total_users), 0);
      const totalActions = dailyStats.reduce((sum, day) => sum + day.total_actions, 0);
      const avgSessionDuration = dailyStats.length > 0
        ? dailyStats.reduce((sum, day) => sum + day.avg_session_duration, 0) / dailyStats.length
        : 0;

      return {
        period: {
          from: dateFrom,
          to: dateTo
        },
        overview: {
          total_users: totalUsers,
          total_actions: totalActions,
          avg_session_duration: avgSessionDuration,
          total_errors: errorAnalysis.reduce((sum, error) => sum + error.error_count, 0)
        },
        daily_stats: dailyStats,
        feature_popularity: featurePopularity,
        error_analysis: errorAnalysis,
        performance_summary: performanceSummary
      };
    } catch (error) {
      console.error('Error generating system report:', error);
      throw error;
    }
  },

  // Atualizar views materializadas manualmente
  async refreshMaterializedViews(): Promise<void> {
    try {
      const views = [
        'mv_user_activity_summary',
        'mv_daily_usage_stats',
        'mv_feature_popularity'
      ];

      for (const view of views) {
        const { error } = await supabase.rpc('refresh_materialized_view', {
          view_name: view
        });

        if (error) {
          console.error(`Error refreshing view ${view}:`, error);
        }
      }
    } catch (error) {
      console.error('Error refreshing materialized views:', error);
      throw error;
    }
  }
};