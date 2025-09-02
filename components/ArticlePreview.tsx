import React from 'react';
import { AnyDraft, GroundingSource, ExtractedFacts, GenerationType, ArticleDraft, HistoriaDraft, OrganizadorDraft } from '../types';
import { LinkIcon, SparklesIcon, PencilIcon, CheckCircleIcon, MapPinIcon, PhoneIcon, GlobeAltIcon, HashtagIcon, ImageIcon } from './icons/Icons';
import LoadingSpinner from './LoadingSpinner';

interface ArticlePreviewProps {
  draft: AnyDraft;
  sources: GroundingSource[];
  generationType: GenerationType;
  onSendToEditor: () => void;
  onEventCreate: () => void;
  isActionLoading: boolean;
  actionError: string | null;
  actionSuccess: string | null;
}

const tagColors: { [key: string]: string } = {
  'Notícias': 'bg-brand-cyan/10 text-brand-cyan',
  'Descubra': 'bg-brand-green/10 text-brand-green',
  'Histórias': 'bg-brand-purple/10 text-brand-purple',
  'Cultura': 'bg-brand-purple/10 text-brand-purple',
  'Personagens': 'bg-brand-pink/10 text-brand-pink',
  'Agenda': 'bg-brand-yellow-dark/10 text-brand-yellow-dark',
  'Comunidade': 'bg-brand-yellow-dark/10 text-brand-yellow-dark',
  'Roteiros': 'bg-blue-100 text-blue-800',
  'Alta': 'bg-brand-red/10 text-brand-red',
  'Média': 'bg-brand-yellow-light/20 text-yellow-800',
  'Baixa': 'bg-blue-100 text-blue-800',
};

const getTagColor = (text: string) => tagColors[text] || 'bg-gray-100 text-gray-800';

const VerifiedFacts: React.FC<{ facts: ExtractedFacts }> = ({ facts }) => {
    const factItems = [
        { label: "Evento", value: facts.eventName },
        { label: "Data", value: facts.eventDate },
        { label: "Local", value: facts.eventLocation },
        { label: "Organizadores", value: facts.organizers?.join(', ') },
        { label: "Pessoas-chave", value: facts.keyPeople?.join(', ') },
    ].filter(item => item.value);

    if (factItems.length === 0) return null;

    return (
        <div className="p-4 bg-brand-green/10 rounded-lg border border-brand-green/50 space-y-3">
            <div className="flex items-center text-sm font-semibold text-green-800">
                <CheckCircleIcon solid className="h-5 w-5 mr-2" />
                <span>Fatos Verificados pela IA</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {factItems.map(item => (
                    <div key={item.label}>
                        <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide">{item.label}</h3>
                        <p className="text-sm text-green-900 font-medium">{item.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SeoStrategy: React.FC<{ draft: ArticleDraft | HistoriaDraft }> = ({ draft }) => {
    // Debug: Log dos campos de SEO
    console.log('SeoStrategy - Draft recebido:', {
        focus_keyword: draft.focus_keyword,
        suggested_alt_text: draft.suggested_alt_text,
        hasFields: {
            focus_keyword: !!draft.focus_keyword,
            suggested_alt_text: !!draft.suggested_alt_text
        }
    });

    return (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <div className="flex items-center text-sm font-semibold text-gray-600">
                <SparklesIcon className="h-5 w-5 mr-2 text-brand-purple" />
                <span>Estratégia de SEO da IA</span>
            </div>
            <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Palavra-chave de Foco</h3>
                <p className="text-sm text-gray-800 font-medium">
                    {draft.focus_keyword || <span className="text-gray-400 italic">Não definida</span>}
                </p>
            </div>
            <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Texto Alternativo Sugerido (Imagem)</h3>
                <p className="text-sm text-gray-800">
                    {draft.suggested_alt_text || <span className="text-gray-400 italic">Não definido</span>}
                </p>
            </div>
        </div>
    );
};

const OrganizadorInfo: React.FC<{ draft: OrganizadorDraft }> = ({ draft }) => {
    const infoItems = [
        { icon: <MapPinIcon className="h-5 w-5 text-gray-500" />, value: draft.address },
        { icon: <PhoneIcon className="h-5 w-5 text-gray-500" />, value: draft.phone },
        { icon: <GlobeAltIcon className="h-5 w-5 text-gray-500" />, value: draft.website, isLink: true },
        { icon: <HashtagIcon className="h-5 w-5 text-gray-500" />, value: draft.instagram },
    ].filter(item => item.value);

    if(infoItems.length === 0) return null;

    return (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
             <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Informações de Contato</h3>
             <div className="space-y-2">
                {infoItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                        {item.icon}
                        {item.isLink ? (
                            <a href={item.value!} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-blue-dark hover:underline truncate">{item.value}</a>
                        ) : (
                            <p className="text-sm text-gray-800">{item.value}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

const ImageSearchSuggestions: React.FC<{ searches: string[] }> = ({ searches }) => (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
        <div className="flex items-center text-sm font-semibold text-blue-800">
            <ImageIcon className="h-5 w-5 mr-2" />
            <span>Sugestões de Imagem (Busca)</span>
        </div>
        <ul className="space-y-1 list-disc list-inside">
            {searches.map((query, index) => (
                <li key={index} className="text-sm">
                    <a 
                        href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-brand-blue-dark hover:underline"
                    >
                        {query}
                    </a>
                </li>
            ))}
        </ul>
    </div>
);


const ArticlePreview: React.FC<ArticlePreviewProps> = ({ draft, sources, generationType, onSendToEditor, onEventCreate, isActionLoading, actionError, actionSuccess }) => {
  
  const renderHeader = () => {
    if (generationType === 'organizador') {
        const d = draft as OrganizadorDraft;
        return <h2 className="text-2xl font-bold text-gray-900">{d.title}</h2>
    }
    const d = draft as ArticleDraft | HistoriaDraft;
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getTagColor(d.category)}`}>{d.category}</span>
                {'importance' in d && <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getTagColor(d.importance)}`}>Importância: {d.importance}</span>}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{d.title}</h2>
            <p className="text-sm text-gray-500 italic">{d.seo_description}</p>
        </div>
    );
  };
  
  const renderBody = () => {
      const bodyHtml = generationType === 'organizador' ? (draft as OrganizadorDraft).description_html : (draft as ArticleDraft | HistoriaDraft).article_body_html;
      const summary = 'summary' in draft ? draft.summary : '';
      return (
          <>
            {summary && (
                <div className="prose prose-sm max-w-none prose-p:text-gray-600 prose-headings:text-gray-900 prose-strong:text-gray-800">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Resumo</h3>
                    <p>{summary}</p>
                </div>
            )}
            <div 
              className="prose prose-sm max-w-none prose-p:text-gray-600 prose-headings:text-gray-900 prose-strong:text-gray-800"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </>
      )
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow space-y-6 overflow-y-auto pr-2 text-gray-800">
        {renderHeader()}
        
        {generationType === 'noticia' && (draft as ArticleDraft).verified_facts && <VerifiedFacts facts={(draft as ArticleDraft).verified_facts!} />}
        
        {(generationType === 'noticia' || generationType === 'historia' || generationType === 'social') && <SeoStrategy draft={draft as ArticleDraft | HistoriaDraft}/>}

        {'suggested_image_searches' in draft && draft.suggested_image_searches && draft.suggested_image_searches.length > 0 && (
            <ImageSearchSuggestions searches={draft.suggested_image_searches} />
        )}

        {generationType === 'organizador' && <OrganizadorInfo draft={draft as OrganizadorDraft} />}

        {generationType === 'noticia' && (draft as ArticleDraft).event_details && (
            <div className="p-4 bg-brand-yellow-dark/10 rounded-lg border border-brand-yellow-dark/50 space-y-3">
                <div className="flex items-center justify-between">
                     <div className="flex items-center text-sm font-semibold text-yellow-800">
                        <SparklesIcon className="h-5 w-5 mr-2" />
                        <span>Evento Sugerido</span>
                    </div>
                     <button onClick={onEventCreate} disabled={isActionLoading} className="flex justify-center items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-brand-yellow-dark hover:bg-orange-600 disabled:bg-gray-400">
                        {isActionLoading ? 'Criando...' : 'Criar na Agenda'}
                    </button>
                </div>
            </div>
        )}

        {renderBody()}
        
        {'tags' in draft && draft.tags.length > 0 && (
          <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Tags Sugeridas</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                  {draft.tags.map(tag => <span key={tag} className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded-md">#{tag}</span>)}
              </div>
          </div>
        )}

        {sources && sources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Fontes da Pesquisa Web</h3>
              <ul className="mt-2 space-y-1">
                  {sources.map((source, index) => (
                      <li key={index} className="flex items-start">
                          <LinkIcon className="h-4 w-4 text-gray-400 mr-2 mt-1 flex-shrink-0" />
                          <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue-dark hover:underline truncate" title={source.web.uri}>
                            {source.web.title || source.web.uri}
                          </a>
                      </li>
                  ))}
              </ul>
            </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
              <div className="text-sm flex-grow">
                {actionError && <p className="text-red-600">{actionError}</p>}
                {actionSuccess && <p className="text-green-600">{actionSuccess}</p>}
              </div>
              <button onClick={onSendToEditor} className="flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-blue-dark hover:bg-blue-700">
                <PencilIcon className="h-5 w-5 mr-2" />
                Revisar e Publicar
                </button>
          </div>
      </div>
    </div>
  );
};

export default ArticlePreview;