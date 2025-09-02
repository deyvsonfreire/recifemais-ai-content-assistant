

import React, { useState, useEffect } from 'react';
import { GoogleEvent, GroundingSource } from '../types';
import { MagnifyingGlassIcon, DocumentTextIcon, LinkIcon, ArrowPathIcon } from './icons/Icons';
import { searchGoogleEvents } from '../services/geminiService';
import { useEventCache } from '../hooks/useEventCache';
import { useAppContext } from '../hooks/useAppContext';
import LoadingSpinner from './LoadingSpinner';

interface GoogleEventsPageProps {
  onCreateAgenda: (event: GoogleEvent) => void;
}

const categoryColors: { [key: string]: string } = {
  'Música': 'bg-brand-purple/10 text-brand-purple',
  'Teatro': 'bg-brand-pink/10 text-brand-pink',
  'Arte & Exposições': 'bg-brand-cyan/10 text-brand-cyan',
  'Gastronomia': 'bg-brand-yellow-dark/10 text-brand-yellow-dark',
  'Festival': 'bg-brand-red/10 text-brand-red',
  'Esporte': 'bg-brand-green/10 text-brand-green',
  'Tecnologia': 'bg-brand-blue-dark/10 text-brand-blue-dark',
  'Outros': 'bg-gray-400/10 text-gray-600',
};
const getTagColor = (category: string) => categoryColors[category] || 'bg-gray-100 text-gray-800';


const EventCard: React.FC<{ event: GoogleEvent; onCreateAgenda: (event: GoogleEvent) => void }> = ({ event, onCreateAgenda }) => {
    const formatDate = (dateString: string) => {
        try {
            const [date, time] = dateString.split(' ');
            if (!date) return "Data não informada";
            
            const [year, month, day] = date.split('-');
            const formattedDate = `${day}/${month}/${year}`;

            if (time) {
                 const [hour, minute] = time.split(':');
                 return `${formattedDate} às ${hour}:${minute}`;
            }
            return formattedDate;

        } catch (error) {
            console.error("Error formatting date:", dateString, error);
            return dateString; // fallback to original string
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-transform hover:scale-105 duration-200">
            <div className="p-5 flex flex-col flex-grow">
                {event.category && (
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full self-start mb-3 ${getTagColor(event.category)}`}>
                        {event.category}
                    </span>
                )}
                <h3 className="text-lg font-bold text-gray-800 flex-grow">{event.name}</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <p><strong>Quando:</strong> {formatDate(event.start_date)}</p>
                    <p><strong>Onde:</strong> {event.venue || event.location}</p>
                    <p className="pt-2 text-gray-700">{event.summary}</p>
                </div>
                 <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 text-sm font-medium text-brand-blue-dark hover:underline">
                    Ver fonte original
                </a>
            </div>
            <div className="bg-gray-50 p-4 border-t border-gray-200">
                <button
                    onClick={() => onCreateAgenda(event)}
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-red hover:bg-red-700"
                >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    Criar Pauta
                </button>
            </div>
        </div>
    );
};

const Pagination: React.FC<{ currentPage: number; totalPages: number; onPageChange: (page: number) => void; }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <nav className="flex items-center justify-center space-x-2 mt-8">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Anterior
            </button>
            {pageNumbers.map(number => (
                <button key={number} onClick={() => onPageChange(number)} className={`px-3 py-1 rounded-md text-sm font-medium ${currentPage === number ? 'bg-brand-red text-white border-brand-red' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {number}
                </button>
            ))}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 rounded-md text-sm font-medium bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                Próximo
            </button>
        </nav>
    );
};

const formatCacheTime = (isoString: string | null): string => {
    if (!isoString) return '';
    const now = new Date();
    const cacheDate = new Date(isoString);
    const diffSeconds = Math.round((now.getTime() - cacheDate.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);

    if (diffSeconds < 60) return `há poucos segundos`;
    if (diffMinutes < 60) return `há ${diffMinutes} minuto(s)`;
    if (diffHours < 24) return `há ${diffHours} hora(s)`;
    return `em ${cacheDate.toLocaleDateString()}`;
};


const GoogleEventsPage: React.FC<GoogleEventsPageProps> = ({ onCreateAgenda }) => {
  const { session } = useAppContext();
  const { getCachedEvents, cacheEvents } = useEventCache();
  
  const [query, setQuery] = useState('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState("eventos em Recife e Região Metropolitana neste mês");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Analisando sua busca...');
  const [error, setError] = useState<string | null>(null);
  
  const [allEvents, setAllEvents] = useState<GoogleEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<GoogleEvent[]>([]);
  
  const [sources, setSources] = useState<GroundingSource[] | null>([]);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const EVENTS_PER_PAGE = 6;
  
  useEffect(() => {
    if (isLoading) {
        const messages = [
            "Analisando sua busca...",
            "Consultando a web em tempo real...",
            "Filtrando os eventos mais relevantes...",
            "Estruturando os resultados para você...",
            "Quase pronto...",
        ];
        let messageIndex = 0;
        setLoadingMessage(messages[messageIndex]); 
        
        const intervalId = setInterval(() => {
            messageIndex++;
            if(messageIndex < messages.length){
                setLoadingMessage(messages[messageIndex]);
            } else {
                clearInterval(intervalId);
            }
        }, 2000);

        return () => clearInterval(intervalId);
    }
  }, [isLoading]);

  const performSearch = async (searchQuery: string, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    setCacheTimestamp(null);
    setLastSearchedQuery(searchQuery);

    if (!forceRefresh && session?.user?.id) {
        try {
            const cachedEvents = await getCachedEvents(searchQuery);
            if (cachedEvents && cachedEvents.length > 0) {
                setAllEvents(cachedEvents);
                setSources([]);
                setCacheTimestamp(new Date().toISOString());
                setIsLoading(false);
                return;
            }
        } catch (cacheError) {
            console.warn('Cache fetch failed, proceeding with fresh search:', cacheError);
        }
    }

    try {
        const { events, sources: foundSources } = await searchGoogleEvents(searchQuery);
        setSources(foundSources || []);
        if (events.length === 0) {
            setError("Nenhum evento encontrado para esta busca.");
        }
        setAllEvents(events);
        
        // Cache events if user is logged in
        if (session?.user?.id && events.length > 0) {
            try {
                await cacheEvents(searchQuery, events, 'google_search');
            } catch (cacheError) {
                console.warn('Failed to cache events:', cacheError);
            }
        }

    } catch (e: any) {
        setError(e.message || "Ocorreu um erro desconhecido ao buscar eventos.");
    } finally {
        setIsLoading(false);
    }
  };
  
  useEffect(() => {
    performSearch(lastSearchedQuery);
  }, []);
  
  useEffect(() => {
    setCurrentPage(1); // Reset page when filter changes
    if (activeCategory === 'Todos') {
        setFilteredEvents(allEvents);
    } else {
        setFilteredEvents(allEvents.filter(event => event.category === activeCategory));
    }
  }, [activeCategory, allEvents]);


  const handleSearch = () => {
    const queryToSearch = query.trim() ? query : lastSearchedQuery;
    if (!queryToSearch) return;
    performSearch(queryToSearch);
  };
  
  const handleForceRefresh = () => {
      const queryToSearch = query.trim() ? query : lastSearchedQuery;
      if (!queryToSearch) return;
      performSearch(queryToSearch, true);
  };
  
  const indexOfLastEvent = currentPage * EVENTS_PER_PAGE;
  const indexOfFirstEvent = indexOfLastEvent - EVENTS_PER_PAGE;
  const currentEvents = (filteredEvents || []).slice(indexOfFirstEvent, indexOfLastEvent);
  const totalPages = Math.ceil((filteredEvents || []).length / EVENTS_PER_PAGE);

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-20">
                <svg className="animate-spin h-8 w-8 text-brand-purple" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 * 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-4 text-lg font-medium">Buscando eventos na web...</p>
                <p className="mt-1 text-sm text-gray-600 h-5">{loadingMessage}</p>
            </div>
        );
    }

    if (error && (filteredEvents || []).length === 0) {
         return (
            <div className="text-center p-8 py-20">
                 <h2 className="mt-4 text-xl font-medium text-gray-800">Busca sem resultados</h2>
                 <p className="mt-2 text-gray-500 max-w-lg mx-auto">{error}</p>
            </div>
        );
    }

    if ((filteredEvents || []).length > 0) {
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
                    {(currentEvents || []).map((event, index) => (
                        <EventCard key={`${event.source_url}-${index}`} event={event} onCreateAgenda={onCreateAgenda} />
                    ))}
                </div>
                
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

                {sources && sources.length > 0 && (
                    <div className="mt-12 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Fontes da Pesquisa Web</h3>
                    <ul className="mt-3 space-y-1">
                        {(sources || []).map((source, index) => (
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
            </>
        );
    }
    
    return (
        <div className="text-center p-8 py-20">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-4 text-xl font-medium text-gray-800">Encontre Eventos Locais</h2>
            <p className="mt-2 text-gray-500 max-w-lg mx-auto">
                Use a busca acima para encontrar shows, festivais e outros acontecimentos na região para criar pautas.
            </p>
        </div>
    );
  };
  
  const categories = ['Todos', ...Array.from(new Set((allEvents || []).map(event => event.category).filter(Boolean)))];

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Busca de Eventos com IA</h1>
            <p className="mt-2 text-gray-600">
            Encontre pautas de eventos regionais usando a pesquisa do Google.
            </p>
        </div>

        <div className="flex flex-wrap items-start gap-3 mb-6">
            <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ex: shows em Recife este fim de semana"
                className="flex-grow w-full md:w-auto p-3 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm"
            />
            <button
                onClick={handleSearch}
                disabled={isLoading || !query.trim()}
                className="flex-shrink-0 flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-purple hover:bg-purple-700 disabled:bg-gray-400"
            >
                {isLoading && !query.trim() ? <><LoadingSpinner/> Carregando...</> : <><MagnifyingGlassIcon className="h-5 w-5 mr-2" /> Buscar</>}
            </button>
            <button
                onClick={handleForceRefresh}
                disabled={isLoading}
                className="flex-shrink-0 flex items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-300"
                title="Ignora o cache e busca os dados mais recentes"
            >
                <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="ml-2 hidden sm:inline">Forçar Atualização</span>
            </button>
        </div>
        
        {(allEvents || []).length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700 mr-2">Filtrar por:</span>
                {(categories || []).map(category => (
                    <button 
                        key={category} 
                        onClick={() => setActiveCategory(category)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${activeCategory === category ? 'bg-brand-red text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                    >
                        {category}
                    </button>
                ))}
            </div>
             {cacheTimestamp && (
                <p className="mt-3 text-xs text-gray-500 italic">
                   Mostrando resultados de {formatCacheTime(cacheTimestamp)}. Use "Forçar Atualização" para obter os dados mais recentes.
                </p>
            )}
           </div>
        )}
        
        <div className="bg-white rounded-lg shadow-sm min-h-[32rem] border border-gray-200 p-6">
            {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default GoogleEventsPage;
