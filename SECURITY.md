# Política de Segurança

## Versões Suportadas

Atualmente, oferecemos suporte de segurança para as seguintes versões:

| Versão | Suportada          |
| ------ | ------------------ |
| main   | :white_check_mark: |
| < 1.0  | :x:                |

## Reportando uma Vulnerabilidade

A segurança do RecifeMais AI Content Assistant é levada a sério. Se você descobrir uma vulnerabilidade de segurança, por favor, siga estas diretrizes:

### Como Reportar

1. **NÃO** abra uma issue pública para vulnerabilidades de segurança
2. Envie um email para: [deyvsonfreire@gmail.com]
3. Inclua as seguintes informações:
   - Descrição detalhada da vulnerabilidade
   - Passos para reproduzir o problema
   - Versões afetadas
   - Impacto potencial
   - Sugestões de correção (se houver)

### O que Esperar

- **Confirmação**: Você receberá uma confirmação de recebimento em até 48 horas
- **Avaliação**: Avaliaremos a vulnerabilidade em até 7 dias
- **Correção**: Trabalharemos para corrigir vulnerabilidades críticas o mais rápido possível
- **Divulgação**: Coordenaremos a divulgação pública após a correção

### Vulnerabilidades Aceitas

- Injeção de código (XSS, SQL Injection, etc.)
- Problemas de autenticação e autorização
- Exposição de dados sensíveis
- Vulnerabilidades de configuração
- Problemas de validação de entrada

### Fora do Escopo

- Ataques de engenharia social
- Vulnerabilidades em dependências de terceiros (reporte diretamente aos mantenedores)
- Problemas que requerem acesso físico ao dispositivo
- Ataques de força bruta em formulários de login

## Melhores Práticas de Segurança

### Para Desenvolvedores

1. **Variáveis de Ambiente**: Nunca commite chaves de API ou credenciais
2. **Validação de Entrada**: Sempre valide e sanitize dados de entrada
3. **Dependências**: Mantenha dependências atualizadas
4. **HTTPS**: Use sempre HTTPS em produção
5. **Autenticação**: Implemente autenticação robusta

### Para Usuários

1. **Chaves de API**: Mantenha suas chaves de API seguras
2. **Atualizações**: Mantenha o sistema atualizado
3. **Configuração**: Siga as diretrizes de configuração segura
4. **Monitoramento**: Monitore logs para atividades suspeitas

## Configurações de Segurança Recomendadas

### Variáveis de Ambiente

```bash
# Use valores seguros e únicos
SUPABASE_URL=sua_url_supabase
SUPABASE_ANON_KEY=sua_chave_anonima
GEMINI_API_KEY=sua_chave_gemini

# Configure timeouts apropriados
API_TIMEOUT=30000

# Use configurações de produção
NODE_ENV=production
```

### Headers de Segurança

Certifique-se de configurar headers de segurança apropriados:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`

## Auditoria de Segurança

Execute regularmente:

```bash
# Auditoria de dependências
npm audit

# Correção automática de vulnerabilidades
npm audit fix
```

## Contato

Para questões de segurança:
- Email: [deyvsonfreire@gmail.com]
- Para questões não relacionadas à segurança, use as [Issues do GitHub](https://github.com/deyvsonfreire/recifemais-ai-content-assistant/issues)

---

**Nota**: Esta política de segurança pode ser atualizada periodicamente. Verifique regularmente para mudanças.