# Configuração de Provedores de IA Alternativos

Este documento explica como configurar APIs alternativas gratuitas ao Google Gemini para garantir que o sistema continue funcionando mesmo quando o Gemini não estiver disponível.

## 🎯 Visão Geral

O sistema agora inclui um mecanismo de fallback automático que tenta múltiplos provedores de IA em ordem de prioridade:

1. **Google Gemini** (Principal)
2. **Hugging Face Inference API** (Gratuito)
3. **OpenRouter** (Acesso a modelos gratuitos)
4. **Together AI** (Modelos open-source gratuitos)
5. **Groq** (Modelos open-source de alta velocidade)

## 🔧 Configuração das APIs

### 1. Google Gemini (Principal)

**Status**: Já configurado
- Variável: `GEMINI_API_KEY`
- Modelo: `gemini-1.5-flash`
- Custo: Pago

### 2. Hugging Face Inference API

**Status**: Gratuito com limitações
- **Como obter**: 
  1. Acesse [huggingface.co](https://huggingface.co)
  2. Crie uma conta gratuita
  3. Vá em Settings > Access Tokens
  4. Crie um novo token
- **Configuração**: Adicione `HUGGINGFACE_API_KEY=seu_token_aqui` no arquivo `.env`
- **Limitações**: 1000 requests/mês grátis
- **Modelos**: DialoGPT, FLAN-T5, e outros

### 3. OpenRouter

**Status**: Freemium (alguns modelos gratuitos)
- **Como obter**:
  1. Acesse [openrouter.ai](https://openrouter.ai)
  2. Crie uma conta
  3. Alguns modelos são gratuitos (DeepSeek, etc.)
- **Configuração**: Adicione `OPENROUTER_API_KEY=seu_token_aqui` no arquivo `.env`
- **Modelos gratuitos**: `deepseek/deepseek-chat-v3-0324:free`
- **Vantagem**: Acesso a múltiplos modelos através de uma única API

### 4. Together AI

**Status**: Freemium
- **Como obter**:
  1. Acesse [together.ai](https://together.ai)
  2. Crie uma conta
  3. Receba $25 em créditos gratuitos
- **Configuração**: Adicione `TOGETHER_API_KEY=seu_token_aqui` no arquivo `.env`
- **Modelos**: Llama, Mistral, CodeLlama
- **Vantagem**: Modelos open-source de alta qualidade

### 5. Groq

**Status**: Gratuito com limitações
- **Como obter**:
  1. Acesse [groq.com](https://groq.com)
  2. Crie uma conta
  3. Obtenha API key gratuita
- **Configuração**: Adicione `GROQ_API_KEY=seu_token_aqui` no arquivo `.env`
- **Limitações**: 14,400 requests/dia grátis
- **Vantagem**: Velocidade extremamente alta
- **Modelos**: Llama 3.1, Mixtral, Gemma

## 📝 Configuração do Arquivo .env

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# Google Gemini API (Principal)
VITE_GEMINI_API_KEY=sua_chave_gemini_aqui

# Alternative AI Providers (Fallback APIs)
# Hugging Face Inference API (Free)
HUGGINGFACE_API_KEY=sua_chave_huggingface_aqui

# OpenRouter (Access to multiple free models)
OPENROUTER_API_KEY=sua_chave_openrouter_aqui

# Together AI (Free open-source models)
TOGETHER_API_KEY=sua_chave_together_aqui

# Groq (Fast open-source models)
GROQ_API_KEY=sua_chave_groq_aqui
```

## 🚀 Como Funciona o Sistema de Fallback

1. **Tentativa Principal**: O sistema tenta usar o Google Gemini primeiro
2. **Fallback Automático**: Se o Gemini falhar, tenta o próximo provedor na lista
3. **Recuperação Automática**: Provedores que falharam são reativados após 5 minutos
4. **Logs Detalhados**: O sistema registra qual provedor foi usado para cada request

## 📊 Monitoramento

Você pode verificar o status dos provedores através do console do navegador:

```javascript
// No console do navegador
import { aiProviderManager } from './services/aiProviderService';
console.log(aiProviderManager.getProvidersStatus());
```

## 🔄 Reativação Manual

Para reativar todos os provedores manualmente:

```javascript
// No console do navegador
import { aiProviderManager } from './services/aiProviderService';
aiProviderManager.reactivateAllProviders();
```

## 💡 Dicas de Uso

### Para Desenvolvimento
- Configure pelo menos 2-3 provedores para ter redundância
- Groq é excelente para desenvolvimento devido à velocidade
- Hugging Face é bom para testes básicos

### Para Produção
- Configure todos os provedores disponíveis
- Monitore os logs para identificar padrões de falha
- Considere implementar alertas quando todos os provedores falharem

### Economia de Custos
- Use provedores gratuitos para desenvolvimento
- Reserve o Gemini para funcionalidades críticas
- Monitore o uso para evitar exceder limites gratuitos

## 🛠️ Troubleshooting

### Problema: "Nenhum provedor de IA está disponível"
**Solução**: Verifique se pelo menos uma API key está configurada corretamente

### Problema: "Todos os provedores falharam"
**Soluções**:
1. Verifique sua conexão com a internet
2. Verifique se as API keys estão válidas
3. Verifique se você não excedeu os limites de uso
4. Tente reativar os provedores manualmente

### Problema: Respostas de baixa qualidade
**Solução**: Alguns modelos gratuitos podem ter qualidade inferior. Ajuste os prompts ou configure provedores premium.

## 📈 Próximos Passos

1. **Configurar Alertas**: Implementar notificações quando provedores falharem
2. **Métricas**: Adicionar dashboard para monitorar uso e performance
3. **Cache Inteligente**: Implementar cache baseado no provedor usado
4. **Balanceamento**: Distribuir carga entre provedores para otimizar custos

## 🔗 Links Úteis

- [Hugging Face Pricing](https://huggingface.co/pricing)
- [OpenRouter Models](https://openrouter.ai/models)
- [Together AI Pricing](https://together.ai/pricing)
- [Groq Pricing](https://groq.com/pricing/)
- [Comparação de Modelos de IA](https://artificialanalysis.ai/)