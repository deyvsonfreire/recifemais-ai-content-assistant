# Contribuindo para o RecifeMais AI Content Assistant

Obrigado por considerar contribuir para o RecifeMais AI Content Assistant! 🎉

## Como Contribuir

### Reportando Bugs

1. Verifique se o bug já não foi reportado nas [Issues](https://github.com/deyvsonfreire/recifemais-ai-content-assistant/issues)
2. Use o template de bug report
3. Inclua o máximo de detalhes possível
4. Adicione screenshots se aplicável

### Sugerindo Melhorias

1. Verifique se a sugestão já não existe nas [Issues](https://github.com/deyvsonfreire/recifemais-ai-content-assistant/issues)
2. Use o template de feature request
3. Explique claramente o problema que a funcionalidade resolveria
4. Descreva a solução proposta

### Desenvolvimento

#### Pré-requisitos

- Node.js 18+ ou 20+
- npm
- Git

#### Configuração do Ambiente

1. Fork o repositório
2. Clone seu fork:
   ```bash
   git clone https://github.com/SEU_USERNAME/recifemais-ai-content-assistant.git
   cd recifemais-ai-content-assistant
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```

4. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas configurações
   ```

5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

#### Fluxo de Trabalho

1. Crie uma branch para sua feature/fix:
   ```bash
   git checkout -b feature/nome-da-feature
   # ou
   git checkout -b fix/nome-do-bug
   ```

2. Faça suas mudanças
3. Teste suas mudanças:
   ```bash
   npm run build
   npm test # se houver testes
   ```

4. Commit suas mudanças:
   ```bash
   git add .
   git commit -m "feat: adiciona nova funcionalidade X"
   ```

5. Push para seu fork:
   ```bash
   git push origin feature/nome-da-feature
   ```

6. Abra um Pull Request

#### Convenções de Commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` mudanças na documentação
- `style:` formatação, ponto e vírgula faltando, etc
- `refactor:` refatoração de código
- `test:` adição ou correção de testes
- `chore:` mudanças no processo de build, ferramentas auxiliares

#### Padrões de Código

- Use TypeScript
- Siga as configurações do ESLint/Prettier
- Mantenha componentes pequenos e focados
- Adicione comentários para lógica complexa
- Use nomes descritivos para variáveis e funções

#### Estrutura do Projeto

```
src/
├── components/     # Componentes React
├── hooks/         # Custom hooks
├── services/      # Serviços e APIs
├── types/         # Definições de tipos TypeScript
└── utils/         # Funções utilitárias
```

### Pull Requests

1. Use o template de PR
2. Descreva claramente as mudanças
3. Referencie issues relacionadas
4. Certifique-se de que os testes passam
5. Mantenha o PR focado em uma única funcionalidade/correção

### Código de Conduta

- Seja respeitoso e inclusivo
- Aceite feedback construtivo
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros da comunidade

### Dúvidas?

Se você tiver dúvidas, abra uma [Issue](https://github.com/deyvsonfreire/recifemais-ai-content-assistant/issues) com a label "question".

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma licença do projeto.