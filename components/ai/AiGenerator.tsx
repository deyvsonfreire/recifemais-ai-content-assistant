import React, { useState, useCallback, useEffect } from 'react';
import { 
    generateArticleFromPressRelease, 
    generateHistoriaFromTopic, 
    generateOrganizadorProfile, 
    extractTextFromUrl,
    generateArticleFromExtractedText
} from '../../services/geminiService';
import { createCPTItem, getTerms } from '../../services/wordpressService';
import { 
    AnyDraft, 
    GroundingSource, 
    WordPressTerm, 
    InitialPostData,
    GenerationType,
    InitialHistoriaData,
    InitialOrganizadorData,
    ArticleDraft,
    HistoriaDraft
} from '../../types';
import { ArticlePlaceholderIcon, MagicWandIcon, DocumentTextIcon, BookOpenIcon, BuildingOfficeIcon, ShareIcon, ClipboardDocumentCheckIcon } from '../ui/icons/Icons';
import LoadingSpinner from '../ui/LoadingSpinner';
import ArticlePreview from './ArticlePreview';
import { useAppContext } from '../../hooks/useAppContext';

interface AiGeneratorProps {
  onSendToNoticiaEditor: (data: InitialPostData) => void;
  onSendToHistoriaEditor: (data: InitialHistoriaData) => void;
  onSendToOrganizadorEditor: (data: InitialOrganizadorData) => void;
}

const AiGenerator: React.FC<AiGeneratorProps> = ({ 
    onSendToNoticiaEditor,
    onSendToHistoriaEditor,
    onSendToOrganizadorEditor
}) => {
  const { aiPreferences, wordPressCredentials } = useAppContext();
  const [generationType, setGenerationType] = useState<GenerationType>('noticia');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnyDraft | null>(null);
  const [sources, setSources] = useState<GroundingSource[]>([]);

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<WordPressTerm[]>([]);
  const [tags, setTags] = useState<WordPressTerm[]>([]);

  // State for social post flow
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [manualInputText, setManualInputText] = useState('');

  // Reset states on type change
  useEffect(() => {
    setInputValue('');
    setError(null);
    setDraft(null);
    setSources([]);
    setActionError(null);
    setActionSuccess(null);
    setExtractedText(null);
    setIsExtracting(false);
    setIsValidUrl(false);
    setExtractionFailed(false);
    setManualInputText('');
  }, [generationType]);

  // URL validation effect
  useEffect(() => {
    if (generationType === 'social') {
      try {
        new URL(inputValue);
        setIsValidUrl(true);
      } catch (_) {
        setIsValidUrl(false);
      }
    }
  }, [inputValue, generationType]);


  useEffect(() => {
    const fetchTaxonomies = async () => {
      if (wordPressCredentials.siteUrl && wordPressCredentials.username && wordPressCredentials.applicationPassword) {
        try {
          const [fetchedCategories, fetchedTags] = await Promise.all([
            getTerms(wordPressCredentials, 'categories'),
            getTerms(wordPressCredentials, 'tags')
          ]);
          setCategories(fetchedCategories);
          setTags(fetchedTags);
        } catch (error) {
          console.error("Failed to fetch taxonomies:", error);
        }
      }
    };
    fetchTaxonomies();
  }, [wordPressCredentials]);
  
  const handleExtractText = async () => {
    if (!isValidUrl) {
      setError('Por favor, insira uma URL válida.');
      return;
    }
    setIsExtracting(true);
    setError(null);
    setExtractedText(null);
    setExtractionFailed(false);
    setManualInputText('');

    try {
      const text = await extractTextFromUrl(inputValue);
      if (text) {
        setExtractedText(text);
        setExtractionFailed(false);
      } else {
        setError(null);
        setExtractionFailed(true);
      }
    } catch (e: any) {
      setError(`Erro ao tentar conectar: ${e.message}`);
      setExtractionFailed(true);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerate = useCallback(async () => {
    const generationInput = generationType === 'social' ? (extractedText || manualInputText) : inputValue;
    if (!generationInput || !generationInput.trim()) {
      setError('Por favor, insira o conteúdo para geração.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setDraft(null);
    setSources([]);
    setActionError(null);
    setActionSuccess(null);

    try {
        let result: { draft: AnyDraft | null, sources: GroundingSource[] | null };
        switch(generationType) {
            case 'historia':
                result = await generateHistoriaFromTopic(inputValue, aiPreferences.systemInstruction);
                break;
            case 'organizador':
                 result = await generateOrganizadorProfile(inputValue, aiPreferences.systemInstruction);
                 break;
            case 'social':
                 result = await generateArticleFromExtractedText(generationInput, aiPreferences.systemInstruction);
                 break;
            case 'noticia':
            default:
                result = await generateArticleFromPressRelease(inputValue, aiPreferences.systemInstruction);
                break;
        }

      if (result.draft) setDraft(result.draft);
      if (result.sources) setSources(result.sources);

    } catch (e: any) {
      console.error(e);
      setError(`Ocorreu um erro ao gerar o rascunho: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, aiPreferences.systemInstruction, generationType, extractedText, manualInputText]);
  
  const handleSendToEditor = useCallback(() => {
    if (!draft) return;

    const findTermId = (termName: string, termList: WordPressTerm[]) => {
        const nameToFind = termName.trim().toLowerCase();
        const term = termList.find(c => c.name.toLowerCase() === nameToFind);
        return term ? term.id : null;
    }

    const findTermIds = (termNames: string[], termList: WordPressTerm[]) => {
        return termNames
            .map(name => findTermId(name, termList))
            .filter((id): id is number => id !== null);
    }

    switch(generationType) {
        case 'noticia':
        case 'social':
        {
            const d = draft as ArticleDraft;
            const categoryId = findTermId(d.category, categories);
            const tagIds = findTermIds(d.tags, tags);
            onSendToNoticiaEditor({
              title: d.title, content: d.article_body_html, focusKeyword: d.focus_keyword,
              categoryIds: categoryId ? [categoryId] : [],
              tagIds,
            });
            break;
        }
        case 'historia': {
            const d = draft as HistoriaDraft;
            // Assuming historias use standard categories/tags for now. This could be customized.
            const categoryId = findTermId(d.category, categories);
            const tagIds = findTermIds(d.tags, tags);
             onSendToHistoriaEditor({
              title: d.title, content: d.article_body_html, focusKeyword: d.focus_keyword,
              categoryIds: categoryId ? [categoryId] : [],
              tagIds,
            });
            break;
        }
        case 'organizador': {
            const d = draft as any; // OrganizadorDraft
             onSendToOrganizadorEditor({
                title: d.title, content: d.description_html,
                address: d.address || '', phone: d.phone || '', website: d.website || '', instagram: d.instagram || '',
            });
            break;
        }
    }
  }, [draft, generationType, onSendToNoticiaEditor, onSendToHistoriaEditor, onSendToOrganizadorEditor, categories, tags]);

  const handleCreateEvent = useCallback(async () => {
    const articleDraft = draft as ArticleDraft;
    if (generationType !== 'noticia' || !articleDraft?.event_details) return;
    
    const eventDetails = articleDraft.event_details;
    if (!wordPressCredentials.siteUrl || !wordPressCredentials.username || !wordPressCredentials.applicationPassword) {
        setActionError("Credenciais do WordPress não configuradas.");
        return;
    }

    setIsActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
        const postData: any = {
            title: eventDetails.name,
            content: `<p><strong>Quando:</strong> ${eventDetails.date}</p><p><strong>Onde:</strong> ${eventDetails.location}</p><hr><h2>Sobre o Evento</h2><p>${articleDraft.summary}</p>`,
            status: 'draft' as const,
        };
        const newPost = await createCPTItem(wordPressCredentials, 'agenda', postData);
        setActionSuccess(`Evento "${newPost.title.rendered}" criado como rascunho na Agenda!`);
    } catch (e: any) {
        console.error(e);
        setActionError(`Falha ao criar evento: ${e.message}`);
    } finally {
        setIsActionLoading(false);
    }
  }, [draft, wordPressCredentials, generationType]);
  
  const resetSocialFlow = () => {
      setExtractedText(null);
      setInputValue('');
      setManualInputText('');
      setExtractionFailed(false);
      setError(null);
  };

  const generationConfig = {
      noticia: { icon: <DocumentTextIcon className="h-5 w-5 mr-3"/>, title: 'Gerar Notícia', placeholder: 'Cole o texto do e-mail ou comunicado aqui...', inputType: 'textarea', rows: 18 },
      social: { icon: <ShareIcon className="h-5 w-5 mr-3"/>, title: 'Gerar de Rede Social', placeholder: 'Cole a URL do post (ex: Instagram)...', inputType: 'url' },
      historia: { icon: <BookOpenIcon className="h-5 w-5 mr-3"/>, title: 'Gerar História', placeholder: 'Digite um tópico ou tema, ex: "A história da Rua da Aurora"', inputType: 'textarea', rows: 2 },
      organizador: { icon: <BuildingOfficeIcon className="h-5 w-5 mr-3"/>, title: 'Gerar Perfil', placeholder: 'Digite o nome de uma organização, ex: "Paço do Frevo"', inputType: 'textarea', rows: 2 }
  } as const;

  const currentConfig = generationConfig[generationType];

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Assistente de Conteúdo IA</h1>
        <p className="mt-2 text-gray-600">
          Selecione o tipo de conteúdo, insira a informação inicial e deixe a IA fazer o trabalho pesado.
        </p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
             <div className="mb-4 border-b border-gray-200">
                <nav className="-mb-px flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2" aria-label="Tabs">
                    {(Object.keys(generationConfig) as GenerationType[]).map(type => (
                        <button key={type} onClick={() => { setGenerationType(type); setDraft(null); }}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center ${generationType === type ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        >
                           {generationConfig[type].icon} {generationConfig[type].title.split(' ')[1]}
                        </button>
                    ))}
                </nav>
            </div>
            
            {generationType === 'social' ? (
                <>
                {extractedText ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center text-sm font-semibold text-gray-600">
                              <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2 text-brand-purple" />
                              <span>Texto Extraído para Pré-visualização</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700 bg-white p-3 rounded-md max-h-48 overflow-y-auto">{extractedText}</p>
                        </div>
                        <button
                          onClick={handleGenerate}
                          disabled={isLoading}
                          className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-red hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {isLoading ? <><LoadingSpinner /> Gerando...</> : 'Gerar Notícia a partir deste texto'}
                        </button>
                        <button onClick={resetSocialFlow} disabled={isLoading} className="w-full text-center text-sm text-gray-600 hover:text-gray-900">
                          Tentar Outra URL
                        </button>
                    </div>
                ) : isExtracting ? (
                     <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10">
                        <LoadingSpinner />
                        <p className="mt-2">Buscando conteúdo da URL...</p>
                    </div>
                ) : extractionFailed ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-900">
                           <h3 className="font-semibold">Não foi possível ler o post automaticamente</h3>
                           <p className="text-sm mt-1">
                                Isso é comum em redes como o Instagram, que protegem seu conteúdo. Sem problemas!
                                Basta copiar o texto do post e colar no campo abaixo para continuar.
                            </p>
                            <textarea
                                id="manualInput"
                                rows={10}
                                value={manualInputText}
                                onChange={(e) => setManualInputText(e.target.value)}
                                className="mt-3 block w-full p-3 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm text-gray-800 bg-white"
                                placeholder="Cole o texto da legenda do Instagram, Facebook, etc."
                            />
                        </div>
                        {error && <p className="mt-2 text-sm text-red-600">Detalhe do erro: {error}</p>}
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !manualInputText.trim()}
                            className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-red hover:bg-red-700 disabled:bg-gray-400"
                        >
                            {isLoading ? <><LoadingSpinner /> Gerando...</> : 'Gerar Notícia a partir do texto manual'}
                        </button>
                        <button onClick={resetSocialFlow} disabled={isLoading} className="w-full text-center text-sm text-gray-600 hover:text-gray-900">
                            Tentar Outra URL
                        </button>
                    </div>
                ) : (
                    <>
                        <label htmlFor="inputValue" className="block text-sm font-medium text-gray-700 mb-2">{currentConfig.title}</label>
                        <input
                            type="url"
                            id="inputValue"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={isExtracting}
                            className="block w-full p-3 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            placeholder={currentConfig.placeholder}
                        />
                        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                        <button
                          onClick={handleExtractText}
                          disabled={isExtracting || !isValidUrl}
                          className="mt-4 w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-blue-dark hover:bg-blue-800 disabled:bg-gray-400"
                        >
                          {isExtracting ? <><LoadingSpinner /> Buscando...</> : 'Buscar Conteúdo'}
                        </button>
                    </>
                )}
                </>
            ) : (
                <>
                <label htmlFor="inputValue" className="block text-sm font-medium text-gray-700 mb-2">
                  {currentConfig.title}
                </label>
                {currentConfig.inputType === 'textarea' && (
                    <textarea
                        id="inputValue"
                        rows={currentConfig.rows}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={isLoading}
                        className="block w-full p-3 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder={currentConfig.placeholder}
                    />
                )}
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !inputValue.trim()}
                  className="mt-4 w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner />
                      Gerando Rascunho...
                    </>
                  ) : (
                    <>
                      <MagicWandIcon className="h-5 w-5 mr-2" />
                      {currentConfig.title}
                    </>
                  )}
                </button>
                </>
            )}

          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[500px] flex flex-col">
              <div className="p-6 flex-grow">
                 {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <MagicWandIcon className="h-10 w-10 animate-pulse text-brand-purple" />
                        <p className="mt-4 text-lg font-medium">A mágica está acontecendo...</p>
                        <p className="text-sm text-center">Pesquisando na web e escrevendo o conteúdo.</p>
                    </div>
                 ) : draft ? (
                    <ArticlePreview 
                      draft={draft} 
                      sources={sources}
                      generationType={generationType}
                      onSendToEditor={handleSendToEditor}
                      onEventCreate={handleCreateEvent}
                      isActionLoading={isActionLoading}
                      actionError={actionError}
                      actionSuccess={actionSuccess}
                    />
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                         <ArticlePlaceholderIcon className="h-12 w-12" />
                        <p className="mt-4 text-lg font-medium">Seu rascunho aparecerá aqui</p>
                        <p className="text-sm text-center max-w-sm">Pronto para ser revisado e publicado no WordPress.</p>
                    </div>
                 )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiGenerator;
