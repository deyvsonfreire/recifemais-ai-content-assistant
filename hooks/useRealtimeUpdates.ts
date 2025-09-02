import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { useAppContext } from './useAppContext';
import { analyticsService } from '../services/analyticsService';

// Tipos para atualizações em tempo real
interface RealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
  table: string;
  timestamp: Date;
}

interface SubscriptionConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback?: (event: RealtimeEvent) => void;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  error: string | null;
}

interface RealtimeStats {
  totalEvents: number;
  eventsByType: { [key: string]: number };
  eventsByTable: { [key: string]: number };
  averageLatency: number;
  uptime: number;
  lastEventTime: Date | null;
}

export const useRealtimeUpdates = () => {
  const { session } = useAppContext();
  const [subscriptions, setSubscriptions] = useState<Map<string, RealtimeChannel>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastHeartbeat: null,
    reconnectAttempts: 0,
    error: null
  });
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats>({
    totalEvents: 0,
    eventsByType: {},
    eventsByTable: {},
    averageLatency: 0,
    uptime: 0,
    lastEventTime: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const statsInterval = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<Date>(new Date());
  const eventLatencies = useRef<number[]>([]);

  // Função para criar uma nova assinatura
  const subscribe = useCallback(async (config: SubscriptionConfig): Promise<string> => {
    try {
      setIsLoading(true);
      setError(null);

      const subscriptionId = `${config.table}_${Date.now()}`;
      const channel = supabase.channel(subscriptionId);

      // Configurar listener
      channel.on(
        'postgres_changes' as any,
        {
          event: config.event || '*',
          schema: 'public',
          table: config.table,
          filter: config.filter
        },
        (payload) => {
          const eventTime = new Date();
          const latency = eventTime.getTime() - new Date(payload.commit_timestamp || Date.now()).getTime();
          
          // Atualizar estatísticas
          eventLatencies.current.push(latency);
          if (eventLatencies.current.length > 100) {
            eventLatencies.current.shift();
          }

          const realtimeEvent: RealtimeEvent = {
            eventType: payload.eventType as any,
            new: payload.new,
            old: payload.old,
            table: config.table,
            timestamp: eventTime
          };

          // Atualizar estatísticas
          setRealtimeStats(prev => ({
            ...prev,
            totalEvents: prev.totalEvents + 1,
            eventsByType: {
              ...prev.eventsByType,
              [payload.eventType]: (prev.eventsByType[payload.eventType] || 0) + 1
            },
            eventsByTable: {
              ...prev.eventsByTable,
              [config.table]: (prev.eventsByTable[config.table] || 0) + 1
            },
            averageLatency: eventLatencies.current.reduce((a, b) => a + b, 0) / eventLatencies.current.length,
            lastEventTime: eventTime
          }));

          // Chamar callback personalizado
          if (config.callback) {
            config.callback(realtimeEvent);
          }

          // Log da ação
          if (session?.user) {
            analyticsService.logUserAction(
              session.user.id,
              'realtime_event_received',
              'realtime',
              subscriptionId,
              {
                table: config.table,
                eventType: payload.eventType,
                latency
              }
            );
          }
        }
      );

      // Subscrever ao canal
      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: true,
            error: null
          }));
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: false,
            error: 'Erro na conexão do canal'
          }));
        }
      });

      // Armazenar assinatura
      setSubscriptions(prev => new Map(prev.set(subscriptionId, channel)));

      return subscriptionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar assinatura';
      setError(errorMessage);
      
      if (session?.user) {
        analyticsService.logError({
          user_id: session.user.id,
          error_type: 'realtime_subscription_error',
          error_message: errorMessage,
          severity: 'medium',
          stack_trace: null,
          url: null,
          user_agent: null,
          metadata: { config }
        });
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Função para cancelar uma assinatura
  const unsubscribe = useCallback(async (subscriptionId: string): Promise<void> => {
    try {
      const channel = subscriptions.get(subscriptionId);
      if (channel) {
        await channel.unsubscribe();
        setSubscriptions(prev => {
          const newMap = new Map(prev);
          newMap.delete(subscriptionId);
          return newMap;
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar assinatura';
      setError(errorMessage);
      throw err;
    }
  }, [subscriptions]);

  // Função para cancelar todas as assinaturas
  const unsubscribeAll = useCallback(async (): Promise<void> => {
    try {
      const promises = Array.from(subscriptions.keys()).map(id => unsubscribe(id));
      await Promise.all(promises);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar todas as assinaturas';
      setError(errorMessage);
      throw err;
    }
  }, [subscriptions, unsubscribe]);

  // Função para reconectar
  const reconnect = useCallback(async (): Promise<void> => {
    try {
      setConnectionStatus(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));

      // Cancelar todas as assinaturas existentes
      await unsubscribeAll();

      // Aguardar um pouco antes de reconectar
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Recriar conexão
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: true,
        error: null
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao reconectar';
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false,
        error: errorMessage
      }));
      throw err;
    }
  }, [unsubscribeAll]);

  // Função para obter estatísticas detalhadas
  const getDetailedStats = useCallback((): RealtimeStats & {
    activeSubscriptions: number;
    subscriptionDetails: Array<{ id: string; table: string; status: string }>;
  } => {
    const subscriptionDetails = Array.from(subscriptions.entries()).map(([id, channel]) => ({
      id,
      table: id.split('_')[0],
      status: (channel as any).state || 'unknown'
    }));

    return {
      ...realtimeStats,
      uptime: Math.floor((Date.now() - startTime.current.getTime()) / 1000),
      activeSubscriptions: subscriptions.size,
      subscriptionDetails
    };
  }, [realtimeStats, subscriptions]);

  // Função para limpar estatísticas
  const clearStats = useCallback((): void => {
    setRealtimeStats({
      totalEvents: 0,
      eventsByType: {},
      eventsByTable: {},
      averageLatency: 0,
      uptime: 0,
      lastEventTime: null
    });
    eventLatencies.current = [];
    startTime.current = new Date();
  }, []);

  // Configurar heartbeat
  useEffect(() => {
    heartbeatInterval.current = setInterval(() => {
      setConnectionStatus(prev => ({
        ...prev,
        lastHeartbeat: new Date()
      }));
    }, 30000); // 30 segundos

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, []);

  // Configurar atualização de estatísticas
  useEffect(() => {
    statsInterval.current = setInterval(() => {
      setRealtimeStats(prev => ({
        ...prev,
        uptime: Math.floor((Date.now() - startTime.current.getTime()) / 1000)
      }));
    }, 5000); // 5 segundos

    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      unsubscribeAll();
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, [unsubscribeAll]);

  return {
    // Estado
    subscriptions: Array.from(subscriptions.keys()),
    connectionStatus,
    realtimeStats,
    isLoading,
    error,

    // Funções principais
    subscribe,
    unsubscribe,
    unsubscribeAll,
    reconnect,

    // Funções de utilidade
    getDetailedStats,
    clearStats,

    // Computed values
    isConnected: connectionStatus.isConnected,
    hasActiveSubscriptions: subscriptions.size > 0,
    totalEvents: realtimeStats.totalEvents,
    averageLatency: realtimeStats.averageLatency
  };
};

export default useRealtimeUpdates;