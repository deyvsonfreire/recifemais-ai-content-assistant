import { useState, useEffect, useCallback } from 'react';
import { aiProviderManager, generateWithFallback } from '../services/aiProviderService';
import { GroundingSource } from '../types';

interface ProviderStatus {
  name: string;
  isAvailable: boolean;
  priority: number;
}

interface UseAIProvidersReturn {
  // Status dos provedores
  providers: ProviderStatus[];
  availableCount: number;
  totalCount: number;
  isLoading: boolean;
  
  // Funções de controle
  refreshStatus: () => void;
  reactivateAll: () => void;
  
  // Função para gerar conteúdo
  generateContent: (prompt: string) => Promise<{
    text: string;
    sources?: GroundingSource[] | null;
    usedProvider: string;
  }>;
  
  // Estado da última geração
  lastGeneration: {
    isGenerating: boolean;
    error: string | null;
    usedProvider: string | null;
  };
}

export const useAIProviders = (): UseAIProvidersReturn => {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGeneration, setLastGeneration] = useState({
    isGenerating: false,
    error: null as string | null,
    usedProvider: null as string | null
  });

  // Função para atualizar o status dos provedores
  const refreshStatus = useCallback(() => {
    try {
      const status = aiProviderManager.getProvidersStatus();
      setProviders(status);
    } catch (error) {
      console.error('Erro ao obter status dos provedores:', error);
    }
  }, []);

  // Função para reativar todos os provedores
  const reactivateAll = useCallback(() => {
    try {
      aiProviderManager.reactivateAllProviders();
      refreshStatus();
    } catch (error) {
      console.error('Erro ao reativar provedores:', error);
    }
  }, [refreshStatus]);

  // Função para gerar conteúdo com fallback
  const generateContent = useCallback(async (prompt: string) => {
    setLastGeneration(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      usedProvider: null
    }));

    try {
      const result = await generateWithFallback(prompt);
      
      setLastGeneration({
        isGenerating: false,
        error: null,
        usedProvider: result.usedProvider
      });
      
      // Atualiza o status após a geração
      refreshStatus();
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setLastGeneration({
        isGenerating: false,
        error: errorMessage,
        usedProvider: null
      });
      
      // Atualiza o status após o erro
      refreshStatus();
      
      throw error;
    }
  }, [refreshStatus]);

  // Efeito para carregar o status inicial
  useEffect(() => {
    setIsLoading(true);
    refreshStatus();
    setIsLoading(false);
  }, [refreshStatus]);

  // Efeito para atualizar o status periodicamente
  useEffect(() => {
    const interval = setInterval(refreshStatus, 30000); // A cada 30 segundos
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const availableCount = providers.filter(p => p.isAvailable).length;
  const totalCount = providers.length;

  return {
    providers,
    availableCount,
    totalCount,
    isLoading,
    refreshStatus,
    reactivateAll,
    generateContent,
    lastGeneration
  };
};

// Hook simplificado apenas para geração de conteúdo
export const useAIGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedProvider, setUsedProvider] = useState<string | null>(null);

  const generateContent = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setError(null);
    setUsedProvider(null);

    try {
      const result = await generateWithFallback(prompt);
      setUsedProvider(result.usedProvider);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateContent,
    isGenerating,
    error,
    usedProvider,
    clearError: () => setError(null)
  };
};

// Hook para monitorar apenas o status dos provedores
export const useProvidersStatus = () => {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const refreshStatus = useCallback(() => {
    try {
      const status = aiProviderManager.getProvidersStatus();
      setProviders(status);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao obter status dos provedores:', error);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const availableCount = providers.filter(p => p.isAvailable).length;
  const totalCount = providers.length;
  const hasActiveProviders = availableCount > 0;
  const allProvidersDown = totalCount > 0 && availableCount === 0;

  return {
    providers,
    availableCount,
    totalCount,
    hasActiveProviders,
    allProvidersDown,
    lastUpdate,
    refreshStatus
  };
};