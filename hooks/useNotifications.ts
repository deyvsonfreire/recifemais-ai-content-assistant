import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from './useAppContext';
import { analyticsService } from '../services/analyticsService';
import { supabase } from '../services/supabase';

// Tipos para notificações
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  isRead: boolean;
  isPersistent: boolean;
  autoClose: boolean;
  autoCloseDelay?: number;
  actions?: NotificationAction[];
  metadata?: any;
  createdAt: Date;
  expiresAt?: Date;
}

interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

interface NotificationSettings {
  enableSound: boolean;
  enableDesktop: boolean;
  enableInApp: boolean;
  autoCloseDelay: number;
  maxNotifications: number;
  categories: {
    [category: string]: {
      enabled: boolean;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      sound: boolean;
      desktop: boolean;
    };
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: { [type: string]: number };
  byCategory: { [category: string]: number };
  byPriority: { [priority: string]: number };
  todayCount: number;
  weekCount: number;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enableSound: true,
  enableDesktop: true,
  enableInApp: true,
  autoCloseDelay: 5000,
  maxNotifications: 50,
  categories: {
    system: { enabled: true, priority: 'medium', sound: true, desktop: true },
    events: { enabled: true, priority: 'low', sound: false, desktop: false },
    errors: { enabled: true, priority: 'high', sound: true, desktop: true },
    updates: { enabled: true, priority: 'low', sound: false, desktop: false },
    security: { enabled: true, priority: 'urgent', sound: true, desktop: true }
  }
};

export const useNotifications = () => {
  const { session } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Função para solicitar permissão de notificação
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    setPermission(permission);
    return permission;
  }, []);

  // Função para criar uma nova notificação
  const createNotification = useCallback(async (notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<string> => {
    try {
      const notification: Notification = {
        ...notificationData,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        isRead: false
      };

      // Verificar configurações da categoria
      const categorySettings = settings.categories[notification.category];
      if (!categorySettings?.enabled) {
        return notification.id;
      }

      // Adicionar à lista
      setNotifications(prev => {
        const newNotifications = [notification, ...prev];
        // Limitar número máximo de notificações
        return newNotifications.slice(0, settings.maxNotifications);
      });

      // Tocar som se habilitado
      if (settings.enableSound && categorySettings.sound && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }

      // Mostrar notificação desktop se habilitado
      if (settings.enableDesktop && categorySettings.desktop && permission === 'granted') {
        const desktopNotif = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.id
        });

        desktopNotif.onclick = () => {
          markAsRead(notification.id);
          desktopNotif.close();
        };
      }

      // Configurar auto-close se habilitado
      if (notification.autoClose) {
        const delay = notification.autoCloseDelay || settings.autoCloseDelay;
        const timeoutId = setTimeout(() => {
          removeNotification(notification.id);
        }, delay);
        timeoutRefs.current.set(notification.id, timeoutId);
      }

      // Log da ação
      if (session?.user) {
        analyticsService.logUserAction(
          session.user.id,
          'notification_created',
          'notification',
          notification.id,
          {
            type: notification.type,
            category: notification.category,
            priority: notification.priority
          }
        );
      }

      return notification.id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar notificação';
      setError(errorMessage);
      throw err;
    }
  }, [settings, permission, session]);

  // Função para marcar como lida
  const markAsRead = useCallback((notificationId: string): void => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, isRead: true }
          : notif
      )
    );

    // Log da ação
    if (session?.user) {
      analyticsService.logUserAction(
        session.user.id,
        'notification_read',
        'notification',
        notificationId
      );
    }
  }, [session]);

  // Função para marcar todas como lidas
  const markAllAsRead = useCallback((): void => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    );

    // Log da ação
    if (session?.user) {
      analyticsService.logUserAction(
        session.user.id,
        'notifications_mark_all_read',
        'notification'
      );
    }
  }, [session]);

  // Função para remover notificação
  const removeNotification = useCallback((notificationId: string): void => {
    setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    
    // Limpar timeout se existir
    const timeoutId = timeoutRefs.current.get(notificationId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(notificationId);
    }
  }, []);

  // Função para limpar todas as notificações
  const clearAll = useCallback((): void => {
    // Limpar todos os timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    
    setNotifications([]);

    // Log da ação
    if (session?.user) {
      analyticsService.logUserAction(
        session.user.id,
        'notifications_clear_all',
        'notification'
      );
    }
  }, [session]);

  // Função para atualizar configurações
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>): Promise<void> => {
    try {
      setIsLoading(true);
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);

      // Salvar no localStorage
      localStorage.setItem('notification_settings', JSON.stringify(updatedSettings));

      // Log da ação
      if (session?.user) {
        analyticsService.logUserAction(
          session.user.id,
          'notification_settings_updated',
          'settings',
          undefined,
          { changes: newSettings }
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar configurações';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [settings, session]);

  // Função para obter estatísticas
  const getStats = useCallback((): NotificationStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.isRead).length,
      byType: {},
      byCategory: {},
      byPriority: {},
      todayCount: notifications.filter(n => n.createdAt >= today).length,
      weekCount: notifications.filter(n => n.createdAt >= weekAgo).length
    };

    notifications.forEach(notif => {
      stats.byType[notif.type] = (stats.byType[notif.type] || 0) + 1;
      stats.byCategory[notif.category] = (stats.byCategory[notif.category] || 0) + 1;
      stats.byPriority[notif.priority] = (stats.byPriority[notif.priority] || 0) + 1;
    });

    return stats;
  }, [notifications]);

  // Funções de conveniência para tipos específicos
  const showSuccess = useCallback((title: string, message: string, options?: Partial<Notification>) => {
    return createNotification({
      title,
      message,
      type: 'success',
      priority: 'low',
      category: 'system',
      isPersistent: false,
      autoClose: true,
      ...options
    });
  }, [createNotification]);

  const showError = useCallback((title: string, message: string, options?: Partial<Notification>) => {
    return createNotification({
      title,
      message,
      type: 'error',
      priority: 'high',
      category: 'errors',
      isPersistent: true,
      autoClose: false,
      ...options
    });
  }, [createNotification]);

  const showWarning = useCallback((title: string, message: string, options?: Partial<Notification>) => {
    return createNotification({
      title,
      message,
      type: 'warning',
      priority: 'medium',
      category: 'system',
      isPersistent: false,
      autoClose: true,
      autoCloseDelay: 8000,
      ...options
    });
  }, [createNotification]);

  const showInfo = useCallback((title: string, message: string, options?: Partial<Notification>) => {
    return createNotification({
      title,
      message,
      type: 'info',
      priority: 'low',
      category: 'system',
      isPersistent: false,
      autoClose: true,
      ...options
    });
  }, [createNotification]);

  // Carregar configurações do localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('notification_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (err) {
        console.error('Erro ao carregar configurações de notificação:', err);
      }
    }
  }, []);

  // Verificar permissão de notificação
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Criar elemento de áudio para notificações
  useEffect(() => {
    audioRef.current = new Audio('/notification-sound.mp3');
    audioRef.current.volume = 0.5;
    
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  // Cleanup timeouts ao desmontar
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  return {
    // Estado
    notifications,
    settings,
    isLoading,
    error,
    permission,

    // Funções principais
    createNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    updateSettings,
    requestPermission,

    // Funções de conveniência
    showSuccess,
    showError,
    showWarning,
    showInfo,

    // Funções de utilidade
    getStats,

    // Computed values
    unreadCount: notifications.filter(n => !n.isRead).length,
    hasUnread: notifications.some(n => !n.isRead),
    recentNotifications: notifications.slice(0, 10),
    urgentNotifications: notifications.filter(n => n.priority === 'urgent' && !n.isRead)
  };
};

export default useNotifications;