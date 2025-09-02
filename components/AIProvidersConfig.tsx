import React, { useState, useEffect } from 'react';
import { AIProviderConfig } from '../types';
import { aiProviderManager } from '../services/aiProviderService';
import { SparklesIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from './ui/icons/Icons';

interface AIProvidersConfigProps {
  onConfigChange?: () => void;
}

const AIProvidersConfig: React.FC<AIProvidersConfigProps> = ({ onConfigChange }) => {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [preferredProvider, setPreferredProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = () => {
    const configs = aiProviderManager.getProvidersConfig();
    setProviders(configs);
    setPreferredProvider(aiProviderManager.getPreferredProvider());
  };

  const handleProviderToggle = async (providerName: string, isEnabled: boolean) => {
    setIsLoading(true);
    try {
      aiProviderManager.updateProviderConfig(providerName, isEnabled);
      
      // Se desabilitou o provedor preferido, remove a preferência
      if (!isEnabled && preferredProvider === providerName) {
        aiProviderManager.setPreferredProvider(null);
        setPreferredProvider(null);
      }
      
      loadProviders();
      setMessage({ type: 'success', text: `${providerName} ${isEnabled ? 'habilitado' : 'desabilitado'} com sucesso!` });
      onConfigChange?.();
    } catch (error) {
      setMessage({ type: 'error', text: `Erro ao atualizar ${providerName}: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferredProviderChange = async (providerName: string | null) => {
    setIsLoading(true);
    try {
      aiProviderManager.setPreferredProvider(providerName);
      setPreferredProvider(providerName);
      setMessage({ 
        type: 'success', 
        text: providerName 
          ? `${providerName} definido como provedor preferido!` 
          : 'Preferência de provedor removida!' 
      });
      onConfigChange?.();
    } catch (error) {
      setMessage({ type: 'error', text: `Erro ao definir provedor preferido: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPreferences = async () => {
    if (confirm('Tem certeza que deseja resetar todas as preferências de IA? Isso habilitará todos os provedores disponíveis.')) {
      setIsLoading(true);
      try {
        aiProviderManager.resetUserPreferences();
        loadProviders();
        setMessage({ type: 'success', text: 'Preferências resetadas com sucesso!' });
        onConfigChange?.();
      } catch (error) {
        setMessage({ type: 'error', text: `Erro ao resetar preferências: ${error}` });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const getStatusIcon = (provider: AIProviderConfig) => {
    if (!provider.isAvailable) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
    if (provider.isEnabled) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    return <XCircleIcon className="h-5 w-5 text-gray-400" />;
  };

  const getStatusText = (provider: AIProviderConfig) => {
    if (!provider.isAvailable) {
      return 'Indisponível';
    }
    return provider.isEnabled ? 'Habilitado' : 'Desabilitado';
  };

  const enabledProviders = providers.filter(p => p.isEnabled && p.isAvailable);

  // Limpa mensagem após 5 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <SparklesIcon className="h-6 w-6 text-brand-purple mr-3" />
          <h2 className="text-xl font-bold text-gray-800">Configuração de Modelos de IA</h2>
        </div>
        <button
          onClick={handleResetPreferences}
          disabled={isLoading}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Resetar
        </button>
      </div>
      
      <p className="text-sm text-gray-500 mb-6">
        Configure quais modelos de IA estarão disponíveis e defina sua preferência. 
        O sistema tentará usar o provedor preferido primeiro, com fallback automático para outros habilitados.
      </p>

      {message && (
        <div className={`mb-4 p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
          message.type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
          'bg-blue-100 text-blue-700 border border-blue-200'
        }`}>
          {message.text}
        </div>
      )}

      {enabledProviders.length === 0 && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 text-yellow-800 rounded-md text-sm flex items-center">
          <ArrowPathIcon className="h-5 w-5 mr-2" />
          <span>Atenção: Nenhum provedor está habilitado e disponível. Configure pelo menos um para usar a IA.</span>
        </div>
      )}

      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.name} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  {getStatusIcon(provider)}
                  <h3 className="ml-2 font-semibold text-gray-900">{provider.name}</h3>
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    provider.isAvailable && provider.isEnabled ? 'bg-green-100 text-green-800' :
                    provider.isAvailable ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {getStatusText(provider)}
                  </span>
                  {preferredProvider === provider.name && (
                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Preferido
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{provider.description}</p>
                {provider.requiresApiKey && (
                  <p className="text-xs text-gray-500">
                    <strong>Chave de API:</strong> {provider.apiKeyEnvVar}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col items-end space-y-2 ml-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={provider.isEnabled}
                    disabled={!provider.isAvailable || isLoading}
                    onChange={(e) => handleProviderToggle(provider.name, e.target.checked)}
                    className="mr-2 h-4 w-4 text-brand-purple focus:ring-brand-purple border-gray-300 rounded disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">Habilitar</span>
                </label>
                
                {provider.isEnabled && provider.isAvailable && (
                  <button
                    onClick={() => handlePreferredProviderChange(
                      preferredProvider === provider.name ? null : provider.name
                    )}
                    disabled={isLoading}
                    className={`px-3 py-1 text-xs rounded-md border disabled:opacity-50 ${
                      preferredProvider === provider.name
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {preferredProvider === provider.name ? 'Remover preferência' : 'Definir como preferido'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">Como funciona:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Provedor Preferido:</strong> Será tentado primeiro quando disponível</li>
          <li>• <strong>Fallback Automático:</strong> Se o preferido falhar, outros habilitados serão testados</li>
          <li>• <strong>Prioridade:</strong> Provedores são ordenados por prioridade quando não há preferência</li>
          <li>• <strong>Chaves de API:</strong> Configure as variáveis de ambiente necessárias no arquivo .env</li>
        </ul>
      </div>
    </div>
  );
};

export default AIProvidersConfig;