import { useState, useCallback, useEffect } from 'react';
import { useAppContext } from './useAppContext';
import { analyticsService } from '../services/analyticsService';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface AlertRule {
  id: string;
  metric: string;
  threshold: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

interface SystemAlert {
  id: string;
  rule: AlertRule;
  value: number;
  timestamp: Date;
  acknowledged: boolean;
  message: string;
}

interface MetricThresholds {
  responseTime: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
  cpuUsage: { warning: number; critical: number };
}

export const useSystemMonitoring = () => {
  const { session } = useAppContext();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    uptime: 0,
    responseTime: 0,
    errorRate: 0,
    activeUsers: 0,
    memoryUsage: 0,
    cpuUsage: 0
  });
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      id: 'response-time-warning',
      metric: 'responseTime',
      threshold: 1000,
      operator: '>',
      severity: 'medium',
      enabled: true
    },
    {
      id: 'response-time-critical',
      metric: 'responseTime',
      threshold: 3000,
      operator: '>',
      severity: 'critical',
      enabled: true
    },
    {
      id: 'error-rate-warning',
      metric: 'errorRate',
      threshold: 5,
      operator: '>',
      severity: 'medium',
      enabled: true
    },
    {
      id: 'error-rate-critical',
      metric: 'errorRate',
      threshold: 10,
      operator: '>',
      severity: 'critical',
      enabled: true
    },
    {
      id: 'memory-usage-warning',
      metric: 'memoryUsage',
      threshold: 80,
      operator: '>',
      severity: 'medium',
      enabled: true
    },
    {
      id: 'memory-usage-critical',
      metric: 'memoryUsage',
      threshold: 95,
      operator: '>',
      severity: 'critical',
      enabled: true
    }
  ]);
  const [monitoringInterval, setMonitoringInterval] = useState<NodeJS.Timeout | null>(null);
  const [thresholds] = useState<MetricThresholds>({
    responseTime: { warning: 1000, critical: 3000 },
    errorRate: { warning: 5, critical: 10 },
    memoryUsage: { warning: 80, critical: 95 },
    cpuUsage: { warning: 80, critical: 95 }
  });

  // Coletar métricas do sistema
  const collectSystemMetrics = useCallback(async (): Promise<SystemHealth> => {
    try {
      // Simular coleta de métricas do sistema
      const startTime = performance.now();
      
      // Buscar métricas de performance do analytics
      const metrics = session?.user?.id 
        ? await analyticsService.getDashboardMetrics(session.user.id)
        : null;
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      // Calcular uso de memória (simulado)
      const memoryInfo = (performance as any).memory;
      const memoryUsage = memoryInfo 
        ? (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100
        : Math.random() * 50 + 20; // Fallback simulado
      
      // Simular CPU usage
      const cpuUsage = Math.random() * 30 + 10;
      
      // Calcular taxa de erro
      const errorRate = metrics 
        ? (metrics.totalErrors / Math.max(metrics.totalApiCalls, 1)) * 100
        : 0;
      
      // Determinar status do sistema
      let status: SystemHealth['status'] = 'healthy';
      if (
        responseTime > thresholds.responseTime.critical ||
        errorRate > thresholds.errorRate.critical ||
        memoryUsage > thresholds.memoryUsage.critical ||
        cpuUsage > thresholds.cpuUsage.critical
      ) {
        status = 'critical';
      } else if (
        responseTime > thresholds.responseTime.warning ||
        errorRate > thresholds.errorRate.warning ||
        memoryUsage > thresholds.memoryUsage.warning ||
        cpuUsage > thresholds.cpuUsage.warning
      ) {
        status = 'warning';
      }
      
      return {
        status,
        uptime: Date.now() - (performance.timeOrigin || 0),
        responseTime,
        errorRate,
        activeUsers: metrics?.totalSessions || 0,
        memoryUsage,
        cpuUsage
      };
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      return {
        status: 'critical',
        uptime: 0,
        responseTime: 0,
        errorRate: 100,
        activeUsers: 0,
        memoryUsage: 0,
        cpuUsage: 0
      };
    }
  }, [session?.user?.id, thresholds]);

  // Verificar regras de alerta
  const checkAlertRules = useCallback((health: SystemHealth): SystemAlert[] => {
    const newAlerts: SystemAlert[] = [];
    
    alertRules.forEach(rule => {
      if (!rule.enabled) return;
      
      const metricValue = health[rule.metric as keyof SystemHealth] as number;
      let shouldAlert = false;
      
      switch (rule.operator) {
        case '>':
          shouldAlert = metricValue > rule.threshold;
          break;
        case '<':
          shouldAlert = metricValue < rule.threshold;
          break;
        case '>=':
          shouldAlert = metricValue >= rule.threshold;
          break;
        case '<=':
          shouldAlert = metricValue <= rule.threshold;
          break;
        case '=':
          shouldAlert = metricValue === rule.threshold;
          break;
      }
      
      if (shouldAlert) {
        // Verificar se já existe um alerta similar não reconhecido
        const existingAlert = alerts.find(
          alert => alert.rule.id === rule.id && !alert.acknowledged
        );
        
        if (!existingAlert) {
          newAlerts.push({
            id: `${rule.id}-${Date.now()}`,
            rule,
            value: metricValue,
            timestamp: new Date(),
            acknowledged: false,
            message: `${rule.metric} (${metricValue}) ${rule.operator} ${rule.threshold}`
          });
        }
      }
    });
    
    return newAlerts;
  }, [alertRules, alerts]);

  // Iniciar monitoramento
  const startMonitoring = useCallback((intervalMs: number = 10000): void => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }
    
    setIsMonitoring(true);
    
    const interval = setInterval(async () => {
      const health = await collectSystemMetrics();
      setSystemHealth(health);
      
      const newAlerts = checkAlertRules(health);
      if (newAlerts.length > 0) {
        setAlerts(prev => [...prev, ...newAlerts]);
        
        // Log alertas críticos
        newAlerts.forEach(alert => {
          if (alert.rule.severity === 'critical' && session?.user?.id) {
            analyticsService.logError({
              user_id: session.user.id,
              error_type: 'system_alert',
              error_message: alert.message,
              stack_trace: null,
              url: null,
              user_agent: null,
              severity: alert.rule.severity,
              metadata: { alert, health }
            });
          }
        });
      }
    }, intervalMs);
    
    setMonitoringInterval(interval);
  }, [monitoringInterval, collectSystemMetrics, checkAlertRules, session?.user?.id]);

  // Parar monitoramento
  const stopMonitoring = useCallback((): void => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      setMonitoringInterval(null);
    }
    setIsMonitoring(false);
  }, [monitoringInterval]);

  // Reconhecer alerta
  const acknowledgeAlert = useCallback((alertId: string): void => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  }, []);

  // Limpar alertas reconhecidos
  const clearAcknowledgedAlerts = useCallback((): void => {
    setAlerts(prev => prev.filter(alert => !alert.acknowledged));
  }, []);

  // Adicionar regra de alerta
  const addAlertRule = useCallback((rule: Omit<AlertRule, 'id'>): void => {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`
    };
    setAlertRules(prev => [...prev, newRule]);
  }, []);

  // Remover regra de alerta
  const removeAlertRule = useCallback((ruleId: string): void => {
    setAlertRules(prev => prev.filter(rule => rule.id !== ruleId));
  }, []);

  // Atualizar regra de alerta
  const updateAlertRule = useCallback((ruleId: string, updates: Partial<AlertRule>): void => {
    setAlertRules(prev => 
      prev.map(rule => 
        rule.id === ruleId 
          ? { ...rule, ...updates }
          : rule
      )
    );
  }, []);

  // Obter alertas ativos
  const getActiveAlerts = useCallback((): SystemAlert[] => {
    return alerts.filter(alert => !alert.acknowledged);
  }, [alerts]);

  // Obter alertas por severidade
  const getAlertsBySeverity = useCallback((severity: AlertRule['severity']): SystemAlert[] => {
    return alerts.filter(alert => alert.rule.severity === severity && !alert.acknowledged);
  }, [alerts]);

  // Limpar interval ao desmontar
  useEffect(() => {
    return () => {
      if (monitoringInterval) {
        clearInterval(monitoringInterval);
      }
    };
  }, [monitoringInterval]);

  return {
    isMonitoring,
    systemHealth,
    alerts,
    alertRules,
    startMonitoring,
    stopMonitoring,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    addAlertRule,
    removeAlertRule,
    updateAlertRule,
    getActiveAlerts,
    getAlertsBySeverity,
    collectSystemMetrics
  };
};