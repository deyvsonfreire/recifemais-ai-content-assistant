import { GoogleGenerativeAI } from "@google/generative-ai";
import { GroundingSource, AIProviderConfig } from "../types";

// Função utilitária para limpar e fazer parse de JSON
export function parseJSONResponse(text: string): any {
  // Remove markdown code blocks
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Remove caracteres extras no início e fim
  cleanText = cleanText.trim();
  
  // Remove caracteres de controle problemáticos
  cleanText = cleanText.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Corrige template literals problemáticos (backticks dentro de strings)
  cleanText = cleanText.replace(/"[^"]*`[^"]*"/g, (match) => {
    return match.replace(/`/g, '\\`');
  });
  
  // Remove template literals que não estão dentro de strings JSON válidas
  cleanText = cleanText.replace(/`[\s\S]*?`/g, (match) => {
    // Se está dentro de uma string JSON, mantém mas escapa
    if (match.includes('\n') || match.includes('\r')) {
      return '"' + match.slice(1, -1).replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
    }
    return match.replace(/`/g, '"');
  });
  
  // Remove quebras de linha dentro de strings que podem causar problemas
  cleanText = cleanText.replace(/"[^"]*\n[^"]*"/g, (match) => {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  });
  
  // Tenta extrair apenas o JSON válido se houver texto extra
  const jsonMatch = cleanText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    cleanText = jsonMatch[0];
  }
  
  // Última tentativa de limpeza: remove vírgulas extras antes de chaves/colchetes de fechamento
  cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
  
  try {
    // Tenta fazer o parse
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Erro ao fazer parse do JSON:', {
      originalText: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      cleanedText: cleanText.substring(0, 500) + (cleanText.length > 500 ? '...' : ''),
      error: error
    });
    
    // Tentativa final: extrair apenas o conteúdo entre as primeiras chaves
    const finalMatch = text.match(/\{[\s\S]*?\}/);
    if (finalMatch) {
      try {
        const finalClean = finalMatch[0]
          .replace(/`[\s\S]*?`/g, '""')
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(finalClean);
      } catch (finalError) {
        console.error('Tentativa final de parse também falhou:', finalError);
      }
    }
    
    throw new Error(`Falha ao analisar a resposta JSON: ${error}`);
  }
}

// Tipos para configuração dos provedores
export interface AIProvider {
  name: string;
  isAvailable: boolean;
  priority: number;
  generateContent: (prompt: string) => Promise<{ text: string; sources?: GroundingSource[] | null }>;
}

// Configuração dos provedores de IA
class AIProviderManager {
  private providers: AIProvider[] = [];
  private userEnabledProviders: Set<string> = new Set();
  private userPreferredProvider: string | null = null;

  constructor() {
    this.initializeProviders();
    this.loadUserPreferences();
  }

  private loadUserPreferences() {
    // Carrega preferências do localStorage
    const savedPrefs = localStorage.getItem('ai-provider-preferences');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        this.userEnabledProviders = new Set(prefs.enabledProviders || []);
        this.userPreferredProvider = prefs.preferredProvider || null;
      } catch (error) {
        console.warn('Erro ao carregar preferências de IA:', error);
      }
    }
    
    // Se não há preferências salvas, habilita todos os provedores disponíveis
    if (this.userEnabledProviders.size === 0) {
      this.providers.forEach(provider => {
        this.userEnabledProviders.add(provider.name);
      });
    }
  }

  private saveUserPreferences() {
    const prefs = {
      enabledProviders: Array.from(this.userEnabledProviders),
      preferredProvider: this.userPreferredProvider
    };
    localStorage.setItem('ai-provider-preferences', JSON.stringify(prefs));
  }

  private initializeProviders() {
    // 1. Google Gemini (Principal)
    if (process.env.API_KEY || process.env.GEMINI_API_KEY) {
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      const geminiAI = new GoogleGenerativeAI(apiKey!);
      
      this.providers.push({
        name: 'Google Gemini',
        isAvailable: true,
        priority: 1,
        generateContent: async (prompt: string) => {
          try {
            const model = geminiAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const response = await model.generateContent(prompt);
            return {
              text: response.response.text(),
              sources: null
            };
          } catch (error: any) {
            console.error('Erro no Gemini:', error);
            if (error.message?.includes('API key not valid')) {
              throw new Error('Chave de API do Google Gemini inválida ou expirada');
            }
            throw new Error(`Erro no Google Gemini: ${error.message || 'Erro desconhecido'}`);
          }
        }
      });
    }

    // 2. Hugging Face Inference API (Temporariamente desabilitado devido a problemas de modelo)
    if (false && process.env.HUGGINGFACE_API_KEY) {
      this.providers.push({
        name: 'Hugging Face',
        isAvailable: true,
        priority: 2,
        generateContent: async (prompt: string) => {
          try {
            const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                inputs: prompt,
                parameters: {
                  max_new_tokens: 1000,
                  temperature: 0.7
                }
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            return {
              text: data[0]?.generated_text || '',
              sources: null
            };
          } catch (error: any) {
            console.error('Erro no Hugging Face:', error);
            if (error.message?.includes('404')) {
              throw new Error('Modelo do Hugging Face não encontrado ou indisponível');
            }
            throw new Error(`Erro no Hugging Face: ${error.message || 'Erro desconhecido'}`);
          }
        }
      });
    }

    // 3. OpenRouter (Acesso a múltiplos modelos gratuitos)
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.push({
        name: 'OpenRouter',
        isAvailable: true,
        priority: 3,
        generateContent: async (prompt: string) => {
          try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://recifemais.com',
                'X-Title': 'RecifeMais AI Assistant'
              },
              body: JSON.stringify({
                model: 'deepseek/deepseek-chat-v3-0324:free', // Modelo gratuito
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.7
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              if (response.status === 429) {
                throw new Error('Limite de requisições do OpenRouter excedido. Tente novamente em alguns minutos.');
              }
              throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            return {
              text: data.choices[0]?.message?.content || '',
              sources: null
            };
          } catch (error: any) {
            console.error('Erro no OpenRouter:', error);
            throw new Error(`Erro no OpenRouter: ${error.message || 'Erro desconhecido'}`);
          }
        }
      });
    }

    // 4. Together AI (Modelos open-source gratuitos)
    if (process.env.TOGETHER_API_KEY) {
      this.providers.push({
        name: 'Together AI',
        isAvailable: true,
        priority: 4,
        generateContent: async (prompt: string) => {
          try {
            const response = await fetch('https://api.together.xyz/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.7
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              if (response.status === 401) {
                throw new Error('Chave de API do Together AI inválida ou expirada');
              }
              throw new Error(`Together AI API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            return {
              text: data.choices[0]?.message?.content || '',
              sources: null
            };
          } catch (error: any) {
            console.error('Erro no Together AI:', error);
            throw new Error(`Erro no Together AI: ${error.message || 'Erro desconhecido'}`);
          }
        }
      });
    }

    // 5. Groq (Modelos open-source com alta velocidade)
    if (process.env.GROQ_API_KEY) {
      this.providers.push({
        name: 'Groq',
        isAvailable: true,
        priority: 5,
        generateContent: async (prompt: string) => {
          try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.7
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Groq API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            return {
              text: data.choices[0]?.message?.content || '',
              sources: null
            };
          } catch (error: any) {
            console.error('Erro no Groq:', error);
            throw new Error(`Erro no Groq: ${error.message || 'Erro desconhecido'}`);
          }
        }
      });
    }

    // Ordena provedores por prioridade
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  // Método principal para gerar conteúdo com fallback automático
  async generateContent(prompt: string): Promise<{ text: string; sources?: GroundingSource[] | null; usedProvider: string }> {
    let availableProviders = this.providers
      .filter(p => p.isAvailable && this.userEnabledProviders.has(p.name))
      .sort((a, b) => a.priority - b.priority); // Ordena por prioridade (menor número = maior prioridade)
    
    // Se há um provedor preferido e ele está disponível, tenta ele primeiro
    if (this.userPreferredProvider && this.userEnabledProviders.has(this.userPreferredProvider)) {
      const preferredProvider = availableProviders.find(p => p.name === this.userPreferredProvider);
      if (preferredProvider) {
        availableProviders = [preferredProvider, ...availableProviders.filter(p => p.name !== this.userPreferredProvider)];
      }
    }
    
    if (availableProviders.length === 0) {
      throw new Error('Nenhum provedor de IA está disponível no momento.');
    }

    let lastError: Error | null = null;

    for (const provider of availableProviders) {
      try {
        console.log(`Tentando gerar conteúdo com ${provider.name}...`);
        const result = await provider.generateContent(prompt);
        
        if (result.text && result.text.trim().length > 0) {
          console.log(`✅ Sucesso com ${provider.name}`);
          return {
            ...result,
            usedProvider: provider.name
          };
        }
      } catch (error) {
        console.warn(`❌ Falha com ${provider.name}:`, error);
        lastError = error as Error;
        
        // Marca o provedor como indisponível temporariamente
        provider.isAvailable = false;
        
        // Reativa após 5 minutos
        setTimeout(() => {
          provider.isAvailable = true;
          console.log(`🔄 ${provider.name} reativado`);
        }, 5 * 60 * 1000);
        
        continue;
      }
    }

    throw new Error(`Todos os provedores de IA falharam. Último erro: ${lastError?.message}`);
  }

  // Método para verificar status dos provedores
  getProvidersStatus(): { name: string; isAvailable: boolean; priority: number }[] {
    return this.providers.map(p => ({
      name: p.name,
      isAvailable: p.isAvailable,
      priority: p.priority
    }));
  }

  // Método para obter configurações dos provedores
  getProvidersConfig(): AIProviderConfig[] {
    const configs: AIProviderConfig[] = [
      {
        name: 'Google Gemini',
        isEnabled: this.userEnabledProviders.has('Google Gemini'),
        isAvailable: this.providers.find(p => p.name === 'Google Gemini')?.isAvailable || false,
        priority: 1,
        description: 'Modelo avançado do Google com alta qualidade de resposta',
        requiresApiKey: true,
        apiKeyEnvVar: 'API_KEY ou GEMINI_API_KEY'
      },
      {
        name: 'OpenRouter',
        isEnabled: this.userEnabledProviders.has('OpenRouter'),
        isAvailable: this.providers.find(p => p.name === 'OpenRouter')?.isAvailable || false,
        priority: 3,
        description: 'Acesso a múltiplos modelos gratuitos via OpenRouter',
        requiresApiKey: true,
        apiKeyEnvVar: 'OPENROUTER_API_KEY'
      },
      {
        name: 'Together AI',
        isEnabled: this.userEnabledProviders.has('Together AI'),
        isAvailable: this.providers.find(p => p.name === 'Together AI')?.isAvailable || false,
        priority: 4,
        description: 'Modelos open-source com boa performance',
        requiresApiKey: true,
        apiKeyEnvVar: 'TOGETHER_API_KEY'
      },
      {
        name: 'Groq',
        isEnabled: this.userEnabledProviders.has('Groq'),
        isAvailable: this.providers.find(p => p.name === 'Groq')?.isAvailable || false,
        priority: 5,
        description: 'Modelos open-source com alta velocidade de resposta',
        requiresApiKey: true,
        apiKeyEnvVar: 'GROQ_API_KEY'
      }
    ];
    
    return configs;
  }

  // Método para atualizar configurações dos provedores
  updateProviderConfig(providerName: string, isEnabled: boolean) {
    if (isEnabled) {
      this.userEnabledProviders.add(providerName);
    } else {
      this.userEnabledProviders.delete(providerName);
      // Se o provedor desabilitado era o preferido, remove a preferência
      if (this.userPreferredProvider === providerName) {
        this.userPreferredProvider = null;
      }
    }
    this.saveUserPreferences();
  }

  // Método para definir provedor preferido
  setPreferredProvider(providerName: string | null) {
    if (providerName && !this.userEnabledProviders.has(providerName)) {
      throw new Error('Não é possível definir um provedor desabilitado como preferido');
    }
    this.userPreferredProvider = providerName;
    this.saveUserPreferences();
  }

  // Método para obter provedor preferido
  getPreferredProvider(): string | null {
    return this.userPreferredProvider;
  }

  // Método para forçar reativação de todos os provedores
  reactivateAllProviders(): void {
    this.providers.forEach(p => {
      p.isAvailable = true;
    });
    console.log('🔄 Todos os provedores foram reativados');
  }

  // Método para resetar preferências do usuário
  resetUserPreferences(): void {
    this.userEnabledProviders.clear();
    this.providers.forEach(provider => {
      this.userEnabledProviders.add(provider.name);
    });
    this.userPreferredProvider = null;
    this.saveUserPreferences();
  }
}

// Instância singleton
export const aiProviderManager = new AIProviderManager();

// Função de conveniência para usar no lugar das chamadas diretas do Gemini
export async function generateWithFallback(prompt: string): Promise<{ text: string; sources?: GroundingSource[] | null; usedProvider: string }> {
  return aiProviderManager.generateContent(prompt);
}