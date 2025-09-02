import { GoogleGenerativeAI, GenerateContentResponse } from "@google/generative-ai";
import { AnyDraft, ArticleDraft, GroundingSource, ExtractedFacts, HistoriaDraft, OrganizadorDraft, PlaceDetailsDraft, GoogleEvent, ScrapedEvent, ScrapedEventDetails } from "../types";
import { generateWithFallback } from "./aiProviderService";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenerativeAI(API_KEY);

async function extractFactsFromPressRelease(pressReleaseText: string): Promise<ExtractedFacts | null> {
  const prompt = `
    Sua única tarefa é analisar o comunicado de imprensa abaixo e extrair os fatos principais em um formato JSON.
    - NÃO invente informações. Se um fato não estiver claramente declarado, use 'null' como valor.
    - NÃO use conhecimento externo. Baseie-se APENAS no texto fornecido.
    - Extraia nomes de eventos, datas, locais, organizadores e pessoas-chave mencionadas.

    **Formato de Saída OBRATÓRIO:**
    A resposta DEVE ser um único objeto JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
    NÃO inclua nenhum texto, explicação ou introdução antes ou depois do bloco JSON.

    **Estrutura do Objeto JSON:**
    {
      "eventName": "string | null",
      "eventDate": "string | null",
      "eventLocation": "string | null",
      "organizers": ["string", ...] | null,
      "keyPeople": ["string", ...] | null
    }

    **Comunicado de Imprensa para Análise:**
    ---
    ${pressReleaseText}
    ---
  `;

  try {
      const response = await generateWithFallback(prompt);
      
      if (response.text) {
          const jsonMatch = response.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          const jsonText = jsonMatch ? jsonMatch[1] : response.text;
          console.log(`✅ Fatos extraídos usando: ${response.usedProvider}`);
          return JSON.parse(jsonText) as ExtractedFacts;
      }
      return null;

  } catch (error) {
      console.error("Erro durante extração de fatos:", error);
      throw new Error("Falha ao extrair fatos do comunicado.");
  }
}


export async function generateArticleFromPressRelease(
  pressReleaseText: string,
  systemInstruction: string
): Promise<{ draft: ArticleDraft | null, sources: GroundingSource[] | null }> {
  // Step 1: Extract facts with high precision
  const verifiedFacts = await extractFactsFromPressRelease(pressReleaseText);
  if (!verifiedFacts) {
      throw new Error("Não foi possível verificar os fatos do comunicado. A geração foi interrompida.");
  }
  
  // Step 2: Generate the article using the verified facts as a source of truth
  const prompt = `
      ${systemInstruction}

      **Tarefa Principal:** Atue como um estrategista de conteúdo e especialista em SEO. Transforme o comunicado de imprensa fornecido em uma notícia completa, engajadora e 100% otimizada para SEO.
      
      **VERIFICAÇÃO DE FATOS OBRATÓRIA:**
      Use os "Fatos Verificados" abaixo como a ÚNICA fonte de verdade para detalhes críticos (nome do evento, data, local). NÃO contradiga estas informações.
      Use a pesquisa web para ENRIQUECER o artigo com contexto, mas NÃO para substituir os fatos principais.

      **Fatos Verificados (Fonte da Verdade):**
      \`\`\`json
      ${JSON.stringify(verifiedFacts, null, 2)}
      \`\`\`

      **Regras de Otimização (SEO - Rank Math Style):**
      1.  **Palavra-chave de Foco:** Analise o comunicado e determine a palavra-chave de foco mais relevante.
      2.  **Título (Title):** Deve conter a palavra-chave de foco (preferencialmente no início), ter 50-60 caracteres e um número.
      3.  **Corpo do Artigo (Article Body):** Deve ter mais de 600 palavras, com a palavra-chave posicionada no primeiro parágrafo e em pelo menos um subtítulo (tag \`<h2>\` ou \`<h3>\`).
      4.  **Meta Description (SEO Description):** 120-155 caracteres com a palavra-chave.
      5.  **Imagem (Alt Text):** Crie um texto alternativo descritivo que DEVE conter a palavra-chave de foco.
      6.  **Taxonomia:** Sugira UMA categoria principal e 3 a 5 tags.
      7. **Detecção de Evento (Opcional):** Se o comunicado for sobre um evento, extraia as informações (baseando-se nos Fatos Verificados).
      
      **Regras de Estilo e Qualidade de Escrita:**
      1.  **Fluidez e Legibilidade:** O texto DEVE ser fluído e de fácil leitura. Use parágrafos curtos (máximo 3-4 frases) para otimizar a experiência em telas de celular.
      2.  **Citações e Fontes:** É PROIBIDO incluir citações numéricas no corpo do texto (como \`[1]\`, \`[2, 5]\`, etc.). Se precisar referenciar uma fonte externa da sua pesquisa web, faça-o de forma natural, inserindo um hiperlink (\`<a href="..." target="_blank">texto âncora</a>\`) diretamente no texto.

      **Formato de Saída OBRATÓRIO:**
      A resposta DEVE ser um único objeto JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
      NÃO inclua nenhum texto antes ou depois do bloco JSON.

      **Estrutura do Objeto JSON:**
      {
        "title": "string (Otimizado)",
        "summary": "string (Resumo conciso)",
        "importance": "'Alta' | 'Média' | 'Baixa'",
        "category": "string (Apenas UMA)",
        "subcategory": "string",
        "tags": ["string", ...],
        "seo_description": "string (Otimizado)",
        "article_body_html": "string (HTML, >600 palavras)",
        "focus_keyword": "string",
        "suggested_alt_text": "string (Com palavra-chave)",
        "event_details": { "name": "string", "date": "string", "location": "string" } | null
      }

      **Comunicado de Imprensa para Análise:**
      ---
      ${pressReleaseText}
      ---
    `;
    const result = await executeGeneration<ArticleDraft>(prompt);
    if (result.draft) {
        result.draft.verified_facts = verifiedFacts;
    }
    return result;
}

export async function generateArticleFromScrapedData(
  scrapedData: ScrapedEventDetails,
  systemInstruction: string
): Promise<{ draft: ArticleDraft | null, sources: GroundingSource[] | null }> {
  const prompt = `
      ${systemInstruction}

      **Tarefa Principal:** Atue como um jornalista local e especialista em SEO. As informações abaixo foram extraídas de uma página de venda de ingressos. Transforme esses dados brutos em uma notícia de evento completa, engajadora e otimizada para o portal 'recifemais.com.br'.

      **Dados Extraídos (Fonte Principal):**
      ---
      ${JSON.stringify(scrapedData, null, 2)}
      ---

      **Processo de Escrita e Enriquecimento:**
      1.  **Use os Dados Fornecidos:** Os dados extraídos são a sua fonte principal. Use o título, data, local e descrição como base.
      2.  **Tom Jornalístico:** Reescreva a descrição. Páginas de venda de ingressos são promocionais. Seu texto deve ser informativo e jornalístico. Remova frases como "compre seu ingresso" ou "garanta sua vaga".
      3.  **Pesquisa Web para Contexto:** Use a pesquisa web para enriquecer o artigo. Pesquise sobre o artista, o local do evento ou edições passadas para adicionar mais detalhes e contexto.
      4.  **Complete as Informações:** Se os dados extraídos forem incompletos (ex: sem hora), use a pesquisa para tentar encontrar essa informação.

      **Regras de Otimização (SEO) e Estilo (Idênticas à geração de press release):**
      - Palavra-chave de Foco, Título, Corpo do Artigo (>600 palavras), Meta Description, Alt Text, Taxonomia, etc.
      - O corpo do artigo deve ser em HTML, com parágrafos curtos e subtítulos.
      - É PROIBIDO incluir citações numéricas como [1]. Integre fontes com links <a>.

      **Formato de Saída OBRATÓRIO (JSON):**
      A resposta DEVE ser um único objeto JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
      NÃO inclua nenhum texto antes ou depois do bloco JSON.

      **Estrutura do Objeto JSON:**
      {
        "title": "string (Otimizado)",
        "summary": "string (Resumo conciso)",
        "importance": "'Alta' | 'Média' | 'Baixa'",
        "category": "string (Use 'Agenda' ou similar)",
        "subcategory": "string",
        "tags": ["string", ...],
        "seo_description": "string (Otimizado)",
        "article_body_html": "string (HTML, >600 palavras)",
        "focus_keyword": "string",
        "suggested_alt_text": "string (Com palavra-chave)",
        "event_details": { "name": "string", "date": "string", "location": "string" }
      }
    `;
    const result = await executeGeneration<ArticleDraft>(prompt);
    return result;
}

export async function extractTextFromUrl(url: string): Promise<string | null> {
    const prompt = `
        Sua tarefa é agir como um extrator de conteúdo web. Acesse a URL a seguir e extraia o conteúdo de texto principal da postagem da rede social, como a legenda ou descrição.

        URL: ${url}

        **Regras de Saída:**
        - Retorne APENAS o texto bruto e não formatado da descrição da postagem.
        - NÃO adicione nenhuma explicação, introdução ou formatação.
        - NÃO resuma. Forneça o texto completo.
        - Se não conseguir acessar o conteúdo ou encontrar uma descrição, retorne o texto "ERRO: CONTEUDO_NAO_ENCONTRADO".
    `;

    try {
        // Usa o sistema de fallback com múltiplos provedores
        const response = await generateWithFallback(prompt);

        const text = response.text?.trim();

        if (text && text.toUpperCase() !== "ERRO: CONTEUDO_NAO_ENCONTRADO") {
            console.log(`✅ Extração de texto realizada com sucesso usando: ${response.usedProvider}`);
            return text;
        }

        return null;

    } catch (error) {
        console.error("Erro durante extração de texto da URL:", error);
        return null;
    }
    
    // const prompt = `
    //     Sua tarefa é agir como um extrator de conteúdo web. Acesse a URL a seguir e extraia o conteúdo de texto principal da postagem da rede social, como a legenda ou descrição.

    //     URL: ${url}

    //     **Regras de Saída:**
    //     - Retorne APENAS o texto bruto e não formatado da descrição da postagem.
    //     - NÃO adicione nenhuma explicação, introdução ou formatação.
    //     - NÃO resuma. Forneça o texto completo.
    //     - Se não conseguir acessar o conteúdo ou encontrar uma descrição, retorne o texto "ERRO: CONTEUDO_NAO_ENCONTRADO".
    // `;

    // try {
    //     const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    //     const response = await model.generateContent(prompt);

    //     const text = response.response.text()?.trim();

    //     if (text && text.toUpperCase() !== "ERRO: CONTEUDO_NAO_ENCONTRADO") {
    //         return text;
    //     }

    //     return null;

    // } catch (error) {
    //     console.error("Error during text extraction from URL:", error);
    //     return null;
    // }
}


export async function generateArticleFromExtractedText(
  postText: string,
  systemInstruction: string
): Promise<{ draft: ArticleDraft | null, sources: GroundingSource[] | null }> {
  const prompt = `
      ${systemInstruction}

      **Tarefa Principal:** Atue como um estrategista de conteúdo e especialista em SEO. O texto abaixo foi extraído de uma postagem de rede social. Transforme-o em uma notícia completa, engajadora e otimizada para SEO para o portal 'recifemais.com.br'.

      **Texto Extraído da Rede Social (Fonte Principal):**
      ---
      ${postText}
      ---

      **Processo de Escrita e Enriquecimento:**
      1.  **Análise do Texto:** Use o "Texto Extraído" como a fonte principal de informação.
      2.  **Pesquisa Web para Contexto:** Use a pesquisa na web para enriquecer o artigo. Pesquise sobre as pessoas, lugares ou eventos mencionados para adicionar contexto, informações de fundo e explicar a relevância da postagem. NÃO use a pesquisa para substituir as informações do texto original.
      3.  **Busca de Imagem:** Sugira 2 a 3 termos de busca para encontrar uma imagem de alta qualidade no Google Images. Priorize buscas que incluam o domínio 'recifemais.com.br' (ex: "Evento X recifemais.com.br").

      **Regras de Otimização (SEO) e Estilo (Idênticas à geração de press release):**
      - Palavra-chave de Foco, Título, Corpo do Artigo (>600 palavras), Meta Description, Alt Text, Taxonomia, etc.
      - Use parágrafos curtos.
      - É PROIBIDO incluir citações numéricas como [1]. Integre fontes com links <a>.

      **Formato de Saída OBRATÓRIO (JSON):**
      A resposta DEVE ser um único objeto JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
      NÃO inclua nenhum texto antes ou depois do bloco JSON.

      **Estrutura do Objeto JSON:**
      {
        "title": "string (Otimizado)",
        "summary": "string (Resumo conciso)",
        "importance": "'Alta' | 'Média' | 'Baixa'",
        "category": "string (Apenas UMA)",
        "subcategory": "string",
        "tags": ["string", ...],
        "seo_description": "string (Otimizado)",
        "article_body_html": "string (HTML, >600 palavras)",
        "focus_keyword": "string",
        "suggested_alt_text": "string (Com palavra-chave)",
        "event_details": { "name": "string", "date": "string", "location": "string" } | null,
        "suggested_image_searches": ["string", ...]
      }
    `;
    const result = await executeGeneration<ArticleDraft>(prompt);
    return result;
}


async function generateHistoriaDraft(facts: ExtractedFacts, sources?: GroundingSource[]): Promise<HistoriaDraft | null> {
  try {
    const sourcesText = sources ? sources.map(s => `- ${s.web.title}: ${s.web.uri}`).join('\n') : '';
    
    const prompt = `Com base nos fatos extraídos abaixo, crie uma história para Instagram:

Fatos:
${JSON.stringify(facts, null, 2)}

${sourcesText ? `Fontes adicionais:\n${sourcesText}\n` : ''}
Crie uma história envolvente e visual para Instagram. Retorne um JSON com:
{
  "title": "título da história",
  "content": "texto da história (máximo 2200 caracteres)",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "call_to_action": "chamada para ação"
}`;

    // Usa o sistema de fallback com múltiplos provedores
    const response = await generateWithFallback(prompt);
    
    if (response.text) {
      try {
        const { parseJSONResponse } = await import('./aiProviderService');
        const storyData = parseJSONResponse(response.text);
        console.log(`✅ História gerada com sucesso usando: ${response.usedProvider}`);
        
        return {
          title: storyData.title,
          summary: storyData.content,
          category: storyData.category || 'Histórias',
          tags: storyData.hashtags || [],
          seo_description: storyData.call_to_action || '',
          article_body_html: storyData.content,
          focus_keyword: storyData.title,
          suggested_alt_text: `Imagem relacionada a ${storyData.title}`
        };
      } catch (parseError) {
        console.error('Erro ao analisar JSON da história:', parseError);
        console.error('Resposta bruta:', response.text);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao gerar história:', error);
    return null;
  }
}

export async function generateHistoriaFromTopic(
  topic: string,
  systemInstruction: string
): Promise<{ draft: HistoriaDraft | null, sources: GroundingSource[] | null }> {
    const prompt = `
      ${systemInstruction.replace('notícia', 'história')}

      **Tarefa Principal:** Atue como um contador de histórias e estrategista de conteúdo. Pesquise na web sobre o tópico fornecido e escreva uma "história" longa, detalhada e envolvente. O estilo deve ser mais narrativo e menos factual que uma notícia.
      
      **Tópico para a História:** "${topic}"

      **Regras de SEO e Estrutura:**
      1.  **Título (Title):** Crie um título cativante que inclua o tópico principal.
      2.  **Corpo do Artigo (Article Body):** Deve ter mais de 800 palavras, dividido em seções com subtítulos (<h2>, <h3>). Use uma linguagem rica e descritiva.
      3.  **Meta Description (SEO Description):** 120-155 caracteres que resumem a história e despertam curiosidade.
      4.  **Palavra-chave de Foco:** Use o tópico principal como a palavra-chave de foco.
      5.  **Imagem (Alt Text):** Crie um texto alternativo que descreva uma imagem ideal para a história e inclua a palavra-chave.
      6.  **Taxonomia:** Sugira UMA categoria principal (ex: 'Histórias', 'Cultura', 'Personagens') e 3 a 5 tags relevantes.
      7. **Fontes:** Integre links para fontes externas (\`<a href="...">\`) de forma natural no texto. NÃO use citações como [1].

      **Formato de Saída OBRATÓRIO (JSON):**
      \`\`\`json
      {
        "title": "string",
        "summary": "string (Um parágrafo de introdução/resumo)",
        "category": "string",
        "tags": ["string", ...],
        "seo_description": "string",
        "article_body_html": "string (HTML, >800 palavras)",
        "focus_keyword": "string",
        "suggested_alt_text": "string"
      }
      \`\`\`
    `;
    const result = await executeGeneration<HistoriaDraft>(prompt);
    return result;
}


async function generateOrganizadorDraft(facts: ExtractedFacts, sources?: GroundingSource[]): Promise<OrganizadorDraft | null> {
  try {
    const sourcesText = sources ? sources.map(s => `- ${s.web.title}: ${s.web.uri}`).join('\n') : '';
    
    const prompt = `Com base nos fatos extraídos abaixo, crie um conteúdo para organizador de eventos:

Fatos:
${JSON.stringify(facts, null, 2)}

${sourcesText ? `Fontes adicionais:\n${sourcesText}\n` : ''}
Crie um conteúdo focado em organizadores de eventos. Retorne um JSON com:
{
  "title": "título do conteúdo",
  "content": "conteúdo completo",
  "tips": ["dica1", "dica2"],
  "resources": ["recurso1", "recurso2"]
}`;

    // Usa o sistema de fallback com múltiplos provedores
    const response = await generateWithFallback(prompt);
    
    if (response.text) {
      try {
        const { parseJSONResponse } = await import('./aiProviderService');
        const organizadorData = parseJSONResponse(response.text);
        console.log(`✅ Conteúdo de organizador gerado com sucesso usando: ${response.usedProvider}`);
        
        return {
          title: organizadorData.title,
          description_html: organizadorData.content,
          address: organizadorData.address || null,
          phone: organizadorData.phone || null,
          website: organizadorData.website || null,
          instagram: organizadorData.instagram || null
        };
      } catch (parseError) {
        console.error('Erro ao analisar JSON do organizador:', parseError);
        console.error('Resposta bruta:', response.text);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao gerar conteúdo de organizador:', error);
    return null;
  }
}

export async function generateOrganizadorProfile(
  organizationName: string,
  systemInstruction: string
): Promise<{ draft: OrganizadorDraft | null, sources: GroundingSource[] | null }> {
    const prompt = `
      ${systemInstruction.replace('jornalista expert e editor de SEO', 'pesquisador e redator de perfis')}

      **Tarefa Principal:** Crie um perfil detalhado e bem escrito para a organização fornecida. Use a pesquisa web para encontrar o site oficial, redes sociais e outras fontes confiáveis.
      
      **Nome da Organização:** "${organizationName}"

      **Instruções de Extração e Escrita:**
      1.  **Pesquisa:** Encontre o site oficial, endereço físico, telefone de contato principal e perfil do Instagram, se existirem.
      2.  **Descrição:** Escreva uma descrição informativa sobre a organização em HTML (mínimo de 2 parágrafos). Descreva sua missão, história e atividades principais.
      3.  **Dados Estruturados:** Extraia as informações de contato para os campos específicos. Se não encontrar uma informação, use 'null'. NÃO invente dados.

      **Formato de Saída OBRATÓRIO (JSON):**
      \`\`\`json
      {
        "title": "${organizationName}",
        "description_html": "string (HTML com a descrição)",
        "address": "string | null",
        "phone": "string | null",
        "website": "string (URL completa) | null",
        "instagram": "string (ex: @perfil) | null"
      }
      \`\`\`
    `;
    const result = await executeGeneration<OrganizadorDraft>(prompt);
    return result;
}

async function generatePlaceDetailsDraft(facts: ExtractedFacts, sources?: GroundingSource[]): Promise<PlaceDetailsDraft | null> {
  try {
    const sourcesText = sources ? sources.map(s => `- ${s.web.title}: ${s.web.uri}`).join('\n') : '';
    
    const prompt = `Com base nos fatos extraídos abaixo, crie detalhes sobre um local:

Fatos:
${JSON.stringify(facts, null, 2)}

${sourcesText ? `Fontes adicionais:\n${sourcesText}\n` : ''}
Crie informações detalhadas sobre o local. Retorne um JSON com:
{
  "name": "nome do local",
  "description": "descrição completa",
  "address": "endereço",
  "amenities": ["comodidade1", "comodidade2"],
  "highlights": ["destaque1", "destaque2"]
}`;

    // Usa o sistema de fallback com múltiplos provedores
    const response = await generateWithFallback(prompt);
    
    if (response.text) {
      try {
        const { parseJSONResponse } = await import('./aiProviderService');
        const placeData = parseJSONResponse(response.text);
        console.log(`✅ Detalhes do local gerados com sucesso usando: ${response.usedProvider}`);
        
        return {
          address: placeData.address,
          neighborhood: placeData.neighborhood || null,
          city: placeData.city || null,
          state: placeData.state || null,
          zipcode: placeData.zipcode || null,
          phone: placeData.phone || null,
          website: placeData.website || null,
          description: placeData.description || null
        };
      } catch (parseError) {
        console.error('Erro ao analisar JSON dos detalhes do local:', parseError);
        console.error('Resposta bruta:', response.text);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao gerar detalhes do local:', error);
    return null;
  }
}

export async function searchPlaceInformation(
  placeName: string,
): Promise<{ draft: PlaceDetailsDraft | null, sources: GroundingSource[] | null }> {
    const prompt = `
      **Tarefa:** Atue como um assistente de pesquisa. Sua única função é encontrar informações detalhadas sobre o seguinte local usando a pesquisa na web e retornar os dados em um formato JSON estrito.

      **Local para Pesquisar:** "${placeName}"

      **Instruções de Extração:**
      1.  **Pesquisa Abrangente:** Encontre o endereço completo, telefone, site oficial e uma breve descrição sobre o local.
      2.  **Dados Estruturados:** Extraia as seguintes informações. Se um campo não for encontrado, use 'null' como valor. NÃO invente dados.
      3.  **Endereço:** Separe o endereço em 'address' (rua e número), 'neighborhood' (bairro), 'city' (cidade), 'state' (estado) e 'zipcode' (CEP).

      **Formato de Saída OBRATÓRIO (JSON):**
      A resposta DEVE ser um único objeto JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
      NÃO inclua nenhum texto, explicação ou introdução antes ou depois do bloco JSON.
      \`\`\`json
      {
        "address": "string | null",
        "neighborhood": "string | null",
        "city": "string | null",
        "state": "string | null",
        "zipcode": "string | null",
        "phone": "string | null",
        "website": "string (URL completa) | null",
        "description": "string (Um parágrafo de descrição) | null"
      }
      \`\`\`
    `;
    const result = await executeGeneration<PlaceDetailsDraft>(prompt);
    return result;
}

export async function searchGoogleEvents(
  query: string
): Promise<{ events: GoogleEvent[], sources: GroundingSource[] | null }> {
  const prompt = `
    Sua tarefa é atuar como um pesquisador de eventos locais para a região de Recife, Pernambuco, Brasil.
    Com base na consulta do usuário, use a Pesquisa Google para encontrar eventos relevantes.
    Retorne os resultados como um array JSON dentro de um bloco de código markdown.

    **Consulta:** "${query}"

    **Estrutura do Array JSON:**
    [
      {
        "name": "string",
        "start_date": "string no formato YYYY-MM-DD HH:MM:SS, ou YYYY-MM-DD se a hora for desconhecida",
        "location": "string, ex: 'Recife, PE'",
        "venue": "string, ex: 'Classic Hall'",
        "summary": "string, um resumo conciso de um parágrafo sobre o evento.",
        "source_url": "string, a URL direta para a página de origem.",
        "category": "string, uma categoria relevante como 'Música', 'Teatro', 'Arte & Exposições', 'Gastronomia', 'Festival', 'Esporte', 'Tecnologia' ou 'Outros'."
      }
    ]

    **Regras:**
    - A saída final DEVE ser APENAS o bloco JSON markdown. Não inclua nenhum texto introdutório ou explicações.
    - Se nenhum evento for encontrado, retorne um array vazio [].
    - Extraia as informações com a maior precisão possível dos resultados da pesquisa.
    - Atribua a categoria mais apropriada para cada evento.
  `;

  try {
    // Usa o sistema de fallback com múltiplos provedores
    const response = await generateWithFallback(prompt);
    
    if (response.text) {
        try {
            // Usa a função parseJSONResponse melhorada do aiProviderService
            const { parseJSONResponse } = await import('./aiProviderService');
            const events = parseJSONResponse(response.text) as GoogleEvent[];
            console.log(`✅ Busca de eventos realizada com sucesso usando: ${response.usedProvider}`);
            return { events, sources: response.sources };
        } catch (parseError) {
             console.error("Erro ao analisar JSON da busca de Eventos do Google:", parseError);
             console.error("Resposta bruta:", response.text);
             throw new Error(`A IA retornou dados em um formato inesperado (${response.usedProvider}).`);
        }
    }
    
    return { events: [], sources: null };

  } catch (error) {
    console.error("Erro ao buscar eventos com IA:", error);
    if (error instanceof Error) {
        throw new Error(`Erro na busca de eventos: ${error.message}`);
    }
    throw new Error("Ocorreu um erro desconhecido ao se comunicar com a IA.");
  }
  
  // const prompt = `
  //   Sua tarefa é atuar como um pesquisador de eventos locais para a região de Recife, Pernambuco, Brasil.
  //   Com base na consulta do usuário, use a Pesquisa Google para encontrar eventos relevantes.
  //   Retorne os resultados como um array JSON dentro de um bloco de código markdown.

  //   **Consulta:** "${query}"

  //   **Estrutura do Array JSON:**
  //   [
  //     {
  //       "name": "string",
  //       "start_date": "string no formato YYYY-MM-DD HH:MM:SS, ou YYYY-MM-DD se a hora for desconhecida",
  //       "location": "string, ex: 'Recife, PE'",
  //       "venue": "string, ex: 'Classic Hall'",
  //       "summary": "string, um resumo conciso de um parágrafo sobre o evento.",
  //       "source_url": "string, a URL direta para a página de origem.",
  //       "category": "string, uma categoria relevante como 'Música', 'Teatro', 'Arte & Exposições', 'Gastronomia', 'Festival', 'Esporte', 'Tecnologia' ou 'Outros'."
  //     }
  //   ]

  //   **Regras:**
  //   - A saída final DEVE ser APENAS o bloco JSON markdown. Não inclua nenhum texto introdutório ou explicações.
  //   - Se nenhum evento for encontrado, retorne um array vazio [].
  //   - Extraia as informações com a maior precisão possível dos resultados da pesquisa.
  //   - Atribua a categoria mais apropriada para cada evento.
  // `;

  // try {
  //   const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
  //   const response = await model.generateContent(prompt);

  //   const sources = null; // Grounding não disponível nesta versão
    
  //   if (response.response.text()) {
  //       const jsonMatch = response.response.text().match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  //       const jsonText = jsonMatch ? jsonMatch[1] : response.response.text();

  //       try {
  //           const events = JSON.parse(jsonText) as GoogleEvent[];
  //           return { events, sources };
  //       } catch (parseError) {
  //            console.error("Erro ao analisar JSON da busca de Eventos do Google:", parseError);
  //            console.error("Resposta bruta:", response.response.text());
  //            throw new Error(`A IA retornou dados em um formato inesperado.`);
  //       }
  //   }
    
  //   return { events: [], sources: null };

  // } catch (error) {
  //   console.error("Erro ao chamar a API Gemini para busca de eventos:", error);
  //   if (error instanceof Error) {
  //       throw new Error(`Erro na API Gemini: ${error.message}`);
  //   }
  //   throw new Error("Ocorreu um erro desconhecido ao se comunicar com a IA.");
  // }
}

export async function processScrapedEvents(scrapedEvents: ScrapedEvent[]): Promise<GoogleEvent[]> {
    const prompt = `
      Você é um assistente de curadoria de eventos. Sua tarefa é analisar a lista de eventos brutos coletados de diferentes sites, limpá-los, remover duplicatas e padronizá-los em um formato JSON consistente.

      **Eventos Brutos para Análise:**
      \`\`\`json
      ${JSON.stringify(scrapedEvents.map(e => ({ title: e.raw_title, date: e.raw_date, source: e.source_site, url: e.source_url, data: e.raw_data })), null, 2)}
      \`\`\`

      **Regras de Processamento:**
      1.  **Remover Duplicatas:** Identifique eventos que são essencialmente os mesmos, mesmo que os títulos ou datas sejam ligeiramente diferentes. Mantenha apenas uma entrada para cada evento real.
      2.  **Padronizar Dados:** Converta todas as datas para o formato "YYYY-MM-DD HH:MM:SS" sempre que possível. Se a hora não estiver disponível, use "YYYY-MM-DD".
      3.  **Extrair Informações:** Extraia o nome do evento, data de início, local, nome do local (venue), um breve resumo e a URL de origem.
      4.  **Categorizar:** Atribua a cada evento uma das seguintes categorias: 'Música', 'Teatro', 'Arte & Exposições', 'Gastronomia', 'Festival', 'Esporte', 'Tecnologia', ou 'Outros'.
      5.  **Qualidade:** Se um evento não tiver informações suficientes (como nome ou data), descarte-o.

      **Formato de Saída OBRATÓRIO (JSON):**
      A resposta DEVE ser um único array JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
      NÃO inclua nenhum texto antes ou depois do bloco JSON. Se nenhum evento válido for encontrado, retorne um array vazio \`[]\`.

      **Estrutura do Array JSON:**
      [
        {
          "name": "string",
          "start_date": "string no formato YYYY-MM-DD HH:MM:SS ou YYYY-MM-DD",
          "location": "string, ex: 'Recife, PE'",
          "venue": "string, ex: 'Classic Hall'",
          "summary": "string, um resumo conciso de um parágrafo sobre o evento.",
          "source_url": "string, a URL direta para a página de origem.",
          "category": "string, uma das categorias permitidas."
        }
      ]
    `;

    try {
        // Usa o sistema de fallback com múltiplos provedores
        const response = await generateWithFallback(prompt);

        if (response.text) {
            try {
                // Usa a função parseJSONResponse melhorada do aiProviderService
                const { parseJSONResponse } = await import('./aiProviderService');
                const events = parseJSONResponse(response.text) as GoogleEvent[];
                
                // Validar estrutura da resposta
                if (!Array.isArray(events)) {
                    throw new Error('Resposta da IA não é um array válido de eventos');
                }
                
                console.log(`✅ Processamento de eventos realizado com sucesso usando: ${response.usedProvider}`, {
                    totalEvents: events.length,
                    inputEvents: scrapedEvents.length,
                    timestamp: new Date().toISOString()
                });
                
                return events;
            } catch (parseError) {
                console.error("❌ Erro ao analisar JSON do processamento de eventos:", {
                    error: parseError instanceof Error ? parseError.message : parseError,
                    provider: response.usedProvider,
                    responseLength: response.text?.length || 0,
                    responsePreview: response.text?.substring(0, 200) + '...',
                    timestamp: new Date().toISOString()
                });
                
                // Log da resposta completa apenas em desenvolvimento
                if (process.env.NODE_ENV === 'development') {
                    console.error('Resposta completa da IA:', response.text);
                }
                
                throw new Error(`A IA retornou dados em um formato inesperado (${response.usedProvider}): ${parseError instanceof Error ? parseError.message : 'Erro desconhecido'}`);
            }
        }
        return [];
    } catch (error) {
        console.error("❌ Erro ao processar eventos com a IA:", {
            error: error instanceof Error ? error.message : error,
            inputEventsCount: scrapedEvents.length,
            timestamp: new Date().toISOString()
        });
        
        if (error instanceof Error) {
            throw new Error(`Erro no processamento de eventos: ${error.message}`);
        }
        throw new Error("Falha ao se comunicar com a IA para processar os eventos.");
    }
    
    // const prompt = `
    //   Você é um assistente de curadoria de eventos. Sua tarefa é analisar a lista de eventos brutos coletados de diferentes sites, limpá-los, remover duplicatas e padronizá-los em um formato JSON consistente.

    //   **Eventos Brutos para Análise:**
    //   \`\`\`json
    //   ${JSON.stringify(scrapedEvents.map(e => ({ title: e.raw_title, date: e.raw_date, source: e.source_site, url: e.source_url, data: e.raw_data })), null, 2)}
    //   \`\`\`

    //   **Regras de Processamento:**
    //   1.  **Remover Duplicatas:** Identifique eventos que são essencialmente os mesmos, mesmo que os títulos ou datas sejam ligeiramente diferentes. Mantenha apenas uma entrada para cada evento real.
    //   2.  **Padronizar Dados:** Converta todas as datas para o formato "YYYY-MM-DD HH:MM:SS" sempre que possível. Se a hora não estiver disponível, use "YYYY-MM-DD".
    //   3.  **Extrair Informações:** Extraia o nome do evento, data de início, local, nome do local (venue), um breve resumo e a URL de origem.
    //   4.  **Categorizar:** Atribua a cada evento uma das seguintes categorias: 'Música', 'Teatro', 'Arte & Exposições', 'Gastronomia', 'Festival', 'Esporte', 'Tecnologia', ou 'Outros'.
    //   5.  **Qualidade:** Se um evento não tiver informações suficientes (como nome ou data), descarte-o.

    //   **Formato de Saída OBRATÓRIO (JSON):**
    //   A resposta DEVE ser um único array JSON formatado como um bloco de código markdown \`\`\`json ... \`\`\`.
    //   NÃO inclua nenhum texto antes ou depois do bloco JSON. Se nenhum evento válido for encontrado, retorne um array vazio \`[]\`.

    //   **Estrutura do Array JSON:**
    //   [
    //     {
    //       "name": "string",
    //       "start_date": "string no formato YYYY-MM-DD HH:MM:SS ou YYYY-MM-DD",
    //       "location": "string, ex: 'Recife, PE'",
    //       "venue": "string, ex: 'Classic Hall'",
    //       "summary": "string, um resumo conciso de um parágrafo sobre o evento.",
    //       "source_url": "string, a URL direta para a página de origem.",
    //       "category": "string, uma das categorias permitidas."
    //     }
    //   ]
    // `;

    // try {
    //     const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    //     const response = await model.generateContent(prompt);

    //     if (response.response.text()) {
    //         const jsonMatch = response.response.text().match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    //         const jsonText = jsonMatch ? jsonMatch[1] : response.response.text();
    //         return JSON.parse(jsonText) as GoogleEvent[];
    //     }
    //     return [];
    // } catch (error) {
    //     console.error("Erro ao processar eventos com a IA:", error);
    //     throw new Error("Falha ao se comunicar com a IA para processar os eventos.");
    // }
}


// Generic helper function to run generation and handle response
async function executeGeneration<T>(prompt: string): Promise<{ draft: T | null, sources: GroundingSource[] | null, usedProvider?: string }> {
    try {
        // Usa o sistema de fallback com múltiplos provedores
        const response = await generateWithFallback(prompt);
        
        if (response.text) {
            try {
                // Usa a função parseJSONResponse melhorada do aiProviderService
                const { parseJSONResponse } = await import('./aiProviderService');
                const parsedJson = parseJSONResponse(response.text);
                console.log(`✅ Conteúdo gerado com sucesso usando: ${response.usedProvider}`);
                return { 
                    draft: parsedJson as T, 
                    sources: response.sources,
                    usedProvider: response.usedProvider
                };
            } catch (parseError) {
                 console.error("Erro ao analisar resposta JSON:", parseError);
                 console.error("Texto original da resposta:", response.text);
                 throw new Error(`Falha ao analisar a resposta JSON da IA (${response.usedProvider}).`);
            }
        }
        
        return { draft: null, sources: null };

    } catch (error) {
        console.error("Erro ao gerar conteúdo com IA:", error);
        if (error instanceof Error) {
            throw new Error(`Erro na geração de conteúdo: ${error.message}`);
        }
        throw new Error("Ocorreu um erro desconhecido ao se comunicar com a IA.");
    }
    
    // try {
    //     const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    //     const response = await model.generateContent(prompt);

    //     const sources = null; // Grounding não disponível nesta versão
        
    //     if (response.response.text()) {
    //         const jsonMatch = response.response.text().match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    //         const jsonText = jsonMatch ? jsonMatch[1] : response.response.text();

    //         try {
    //             const parsedJson = JSON.parse(jsonText);
    //             return { draft: parsedJson as T, sources };
    //         } catch (parseError) {
    //              console.error("Error parsing JSON response from Gemini API:", parseError);
    //              console.error("Raw response text:", response.response.text());
    //              throw new Error(`Falha ao analisar a resposta JSON da IA.`);
    //         }
    //     }
        
    //     return { draft: null, sources: null };

    // } catch (error) {
    //     console.error("Error calling Gemini API for article generation:", error);
    //     if (error instanceof Error) {
    //         throw new Error(`Erro na API Gemini: ${error.message}`);
    //     }
    //     throw new Error("Ocorreu um erro desconhecido ao se comunicar com a IA.");
    // }
}