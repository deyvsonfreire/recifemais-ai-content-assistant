import React, { useState, useEffect, useCallback } from 'react';
import { ScrapedEvent, GoogleEvent } from '../types';
import { getUnprocessedEvents, invokeScraper, markEventsAsProcessed } from '../services/scrapedEventsService';
import { processScrapedEvents } from '../services/geminiService';
import { useToast } from '../hooks/useToast';
import LoadingSpinner from './LoadingSpinner';
import { MagicWandIcon, DocumentTextIcon, BookOpenIcon } from './icons/Icons';

interface ScrapedEventsPageProps {
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

const ProcessedEventCard: React.FC<{ event: GoogleEvent; onCreateAgenda: (event: GoogleEvent) => void }> = ({ event, onCreateAgenda }) => {
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
            return dateString;
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


const ScrapedEventsPage: React.FC<ScrapedEventsPageProps> = ({ onCreateAgenda }) => {
  const [unprocessedEvents, setUnprocessedEvents] = useState<ScrapedEvent[]>([]);
  const [processedEvents, setProcessedEvents] = useState<GoogleEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast();

  const fetchUnprocessed = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const events = await getUnprocessedEvents();
      setUnprocessedEvents(events);
    } catch (e: any) {
      setError(e.message);
      showToast(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUnprocessed();
  }, [fetchUnprocessed]);

  const handleInvokeScraper = async () => {
    setIsScraping(true);
    showToast("O robô de coleta foi acionado. Isso pode levar um minuto...", 'info');
    try {
      const result = await invokeScraper();
      showToast(result.message || "Coleta finalizada!", 'success');
      fetchUnprocessed(); // Refresh list after scraping
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setIsScraping(false);
    }
  };
  
  const handleProcessWithAI = async () => {
    if (selectedEventIds.size === 0) {
      showToast("Selecione pelo menos um evento para processar.", 'info');
      return;
    }
    setIsProcessing(true);
    showToast("Enviando eventos para a IA. Ela irá limpar, padronizar e remover duplicatas...", 'info');

    const selectedEvents = unprocessedEvents.filter(e => selectedEventIds.has(e.id));

    try {
        const cleanedEvents = await processScrapedEvents(selectedEvents);
        setProcessedEvents(prev => [...cleanedEvents, ...prev]);
        
        await markEventsAsProcessed(Array.from(selectedEventIds));

        // Update UI state
        setUnprocessedEvents(prev => prev.filter(e => !selectedEventIds.has(e.id)));
        setSelectedEventIds(new Set());
        showToast(`${cleanedEvents.length} eventos foram processados e estão prontos para curadoria.`, 'success');
    } catch (e: any) {
        showToast(e.message, 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEventIds.size === unprocessedEvents.length) {
        setSelectedEventIds(new Set());
    } else {
        setSelectedEventIds(new Set(unprocessedEvents.map(e => e.id)));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Curadoria de Eventos Coletados</h1>
        <p className="mt-2 text-gray-600">
          Gerencie eventos coletados automaticamente e use a IA para prepará-los para publicação.
        </p>

        {/* Section for unprocessed events */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-gray-800">1. Caixa de Entrada de Eventos</h2>
            <div className="flex items-center gap-3">
              <button onClick={handleInvokeScraper} disabled={isScraping} className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-blue-dark hover:bg-blue-800 disabled:bg-gray-400">
                {isScraping ? <><LoadingSpinner/> Verificando</> : 'Verificar Novidades'}
              </button>
              <button onClick={handleProcessWithAI} disabled={isProcessing || selectedEventIds.size === 0} className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-purple hover:bg-purple-700 disabled:bg-gray-400">
                {isProcessing ? <><LoadingSpinner/> Processando</> : <><MagicWandIcon className="h-5 w-5 mr-2"/>Processar com IA</>}
              </button>
            </div>
          </div>
          {isLoading ? (
            <p className="text-gray-500 text-center py-10">Carregando eventos coletados...</p>
          ) : error ? (
            <p className="text-red-500 text-center py-10">{error}</p>
          ) : unprocessedEvents.length === 0 ? (
             <div className="text-center py-10 text-gray-500">
                <BookOpenIcon className="mx-auto h-12 w-12 text-gray-400"/>
                <h3 className="mt-2 font-medium text-gray-800">Tudo em ordem!</h3>
                <p>Não há novos eventos para revisar. Clique em "Verificar Novidades" para buscar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="p-3 text-left">
                      <input type="checkbox" onChange={toggleSelectAll} checked={selectedEventIds.size > 0 && selectedEventIds.size === unprocessedEvents.length} className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red" />
                    </th>
                    <th scope="col" className="p-3 text-left font-medium text-gray-500 uppercase">Título Bruto</th>
                    <th scope="col" className="p-3 text-left font-medium text-gray-500 uppercase">Fonte</th>
                    <th scope="col" className="p-3 text-left font-medium text-gray-500 uppercase">Data Coletada</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {unprocessedEvents.map(event => (
                    <tr key={event.id} className={`${selectedEventIds.has(event.id) ? 'bg-brand-red/5' : ''}`}>
                      <td className="p-3"><input type="checkbox" checked={selectedEventIds.has(event.id)} onChange={() => toggleSelection(event.id)} className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"/></td>
                      <td className="p-3 font-medium text-gray-900">{event.raw_title}</td>
                      <td className="p-3 text-gray-500">{event.source_site}</td>
                      <td className="p-3 text-gray-500">{new Date(event.scraped_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section for processed events */}
        <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">2. Eventos Prontos para Curadoria</h2>
            {processedEvents.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
                    <MagicWandIcon className="mx-auto h-12 w-12 text-gray-400"/>
                    <h3 className="mt-2 font-medium text-gray-800">Aguardando Processamento</h3>
                    <p>Seus eventos processados pela IA aparecerão aqui, prontos para virar pauta.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {processedEvents.map((event, index) => (
                        <ProcessedEventCard key={`${event.source_url}-${index}`} event={event} onCreateAgenda={onCreateAgenda} />
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ScrapedEventsPage;
