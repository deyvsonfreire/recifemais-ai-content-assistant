import React, { useState, useEffect } from 'react';
import { aiProviderManager } from '../services/aiProviderService';

interface ProviderStatus {
  name: string;
  isAvailable: boolean;
  priority: number;
}

interface AIProvidersStatusProps {
  showInDashboard?: boolean;
  className?: string;
}

const AIProvidersStatus: React.FC<AIProvidersStatusProps> = ({ 
  showInDashboard = false, 
  className = '' 
}) => {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const updateProvidersStatus = () => {
    const status = aiProviderManager.getProvidersStatus();
    setProviders(status);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    updateProvidersStatus();
    
    // Atualiza o status a cada 30 segundos
    const interval = setInterval(updateProvidersStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleReactivateAll = () => {
    aiProviderManager.reactivateAllProviders();
    updateProvidersStatus();
  };

  const getStatusIcon = (isAvailable: boolean) => {
    return isAvailable ? '🟢' : '🔴';
  };

  const getStatusText = (isAvailable: boolean) => {
    return isAvailable ? 'Ativo' : 'Inativo';
  };

  const availableCount = providers.filter(p => p.isAvailable).length;
  const totalCount = providers.length;

  if (!showInDashboard && totalCount === 0) {
    return null;
  }

  // Versão compacta para mostrar na interface principal
  if (!showInDashboard) {
    return (
      <div className={`ai-providers-compact ${className}`}>
        <div 
          className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-800"
          onClick={() => setIsExpanded(!isExpanded)}
          title="Status dos Provedores de IA"
        >
          <span>🤖</span>
          <span>{availableCount}/{totalCount} IA ativa{availableCount !== 1 ? 's' : ''}</span>
          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
        </div>
        
        {isExpanded && (
          <div className="absolute z-50 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-64">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-800">Status dos Provedores de IA</h4>
              <button
                onClick={handleReactivateAll}
                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                title="Reativar todos os provedores"
              >
                🔄 Reativar
              </button>
            </div>
            
            <div className="space-y-1">
              {providers.map((provider, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{getStatusIcon(provider.isAvailable)}</span>
                    <span className={provider.isAvailable ? 'text-gray-800' : 'text-gray-500'}>
                      {provider.name}
                    </span>
                    <span className="text-xs text-gray-400">#{provider.priority}</span>
                  </div>
                  <span className={`text-xs ${
                    provider.isAvailable ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {getStatusText(provider.isAvailable)}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
              Última atualização: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Versão completa para dashboard
  return (
    <div className={`ai-providers-dashboard ${className}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Provedores de IA</h3>
            <p className="text-sm text-gray-600">
              {availableCount} de {totalCount} provedores ativos
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={updateProvidersStatus}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              title="Atualizar status"
            >
              🔄 Atualizar
            </button>
            <button
              onClick={handleReactivateAll}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              title="Reativar todos os provedores"
            >
              ⚡ Reativar Todos
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {providers.map((provider, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                provider.isAvailable 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(provider.isAvailable)}</span>
                <div>
                  <div className="font-medium text-gray-800">{provider.name}</div>
                  <div className="text-sm text-gray-600">
                    Prioridade: #{provider.priority}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`font-medium ${
                  provider.isAvailable ? 'text-green-700' : 'text-red-700'
                }`}>
                  {getStatusText(provider.isAvailable)}
                </div>
                {!provider.isAvailable && (
                  <div className="text-xs text-gray-500">
                    Reativação automática em 5min
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalCount === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🤖</div>
            <div className="text-lg font-medium mb-1">Nenhum provedor configurado</div>
            <div className="text-sm">
              Configure as API keys no arquivo .env para ativar os provedores de IA
            </div>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
          <span>Última atualização: {lastUpdate.toLocaleTimeString()}</span>
          <span>Atualização automática a cada 30s</span>
        </div>
      </div>
    </div>
  );
};

export default AIProvidersStatus;