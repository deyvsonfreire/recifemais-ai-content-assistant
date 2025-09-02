import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './useAppContext';
import { analyticsService } from '../services/analyticsService';
import { PerformanceMetric } from '../types';

export const usePerformanceMetrics = () => {
  const { session } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState<{
    responseTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    errorRate: number;
  }>({ responseTime: 0, memoryUsage: 0, cacheHitRate: 0, errorRate: 0 });

  // Registrar métrica de performance
  const recordMetric = useCallback(async (
    metricName: string,
    value: number,
    unit?: string,
    tags?: any
  ): Promise<void> => {
    try {
      await analyticsService.recordPerformanceMetric(metricName, value, unit, tags);
      
      // Atualizar métricas em tempo real
      if (metricName === 'response_time') {
        setRealTimeMetrics(prev => ({ ...prev, responseTime: value }));
      } else if (metricName === 'memory_usage') {
        setRealTimeMetrics(prev => ({ ...prev, memoryUsage: value }));
      } else if (metricName === 'cache_hit_rate') {
        setRealTimeMetrics(prev => ({ ...prev, cacheHitRate: value }));
      } else if (metricName === 'error_rate') {
        setRealTimeMetrics(prev => ({ ...prev, errorRate: value }));
      }
    } catch (error) {
      console.error('Error recording metric:', error);
      throw error;
    }
  }, []);

  // Medir tempo de execução de uma função
  const measureExecutionTime = useCallback(async <T>(
    fn: () => Promise<T>,
    metricName: string,
    tags?: any
  ): Promise<T> => {
    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      await recordMetric(metricName, executionTime, 'ms', tags);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      await recordMetric(`${metricName}_error`, executionTime, 'ms', { ...tags, error: true });
      throw error;
    }
  }, [recordMetric]);

  // Monitorar uso de memória
  const monitorMemoryUsage = useCallback((): void => {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMemory = memInfo.usedJSHeapSize / 1024 / 1024; // MB
      recordMetric('memory_usage', usedMemory, 'MB');
    }
  }, [recordMetric]);

  // Monitorar performance da página
  const monitorPagePerformance = useCallback((): void => {
    if ('getEntriesByType' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        recordMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart, 'ms');
        recordMetric('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ms');
        recordMetric('first_paint', navigation.responseEnd - navigation.fetchStart, 'ms');
      }
    }
  }, [recordMetric]);

  // Buscar métricas históricas
  const fetchMetrics = useCallback(async (metricName?: string, limit: number = 100): Promise<void> => {
    setIsLoading(true);
    try {
      // Como não temos um método específico no analyticsService, vamos simular
      // Em uma implementação real, você adicionaria este método ao analyticsService
      const metricsData: PerformanceMetric[] = [];
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetrics([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calcular estatísticas das métricas
  const calculateMetricStats = useCallback((metricName: string) => {
    const metricValues = metrics
      .filter(m => m.metric_name === metricName)
      .map(m => m.metric_value);

    if (metricValues.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const avg = metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length;
    const min = Math.min(...metricValues);
    const max = Math.max(...metricValues);

    return { avg, min, max, count: metricValues.length };
  }, [metrics]);

  // Detectar anomalias de performance
  const detectAnomalies = useCallback((metricName: string, threshold: number = 2): boolean => {
    const stats = calculateMetricStats(metricName);
    const currentValue = realTimeMetrics.responseTime; // Simplificado para response_time
    
    return currentValue > stats.avg + (threshold * stats.avg);
  }, [calculateMetricStats, realTimeMetrics]);

  // Inicializar monitoramento automático
  useEffect(() => {
    const interval = setInterval(() => {
      monitorMemoryUsage();
    }, 30000); // A cada 30 segundos

    // Monitorar performance da página uma vez
    monitorPagePerformance();

    return () => clearInterval(interval);
  }, [monitorMemoryUsage, monitorPagePerformance]);

  return {
    isLoading,
    metrics,
    realTimeMetrics,
    recordMetric,
    measureExecutionTime,
    monitorMemoryUsage,
    monitorPagePerformance,
    fetchMetrics,
    calculateMetricStats,
    detectAnomalies
  };
};