import React, { useState } from 'react';
import { SymplaCredentials, WordPressCredentials, SymplaEvent } from '../types';
import { TicketIcon, GearIcon, DocumentTextIcon, CalendarDaysIcon } from './icons/Icons';
import { getSymplaEvents } from '../services/symplaService';
import LoadingSpinner from './LoadingSpinner';

interface SymplaPageProps {
  symplaCredentials: SymplaCredentials;
  wordPressCredentials: WordPressCredentials;
  onNavigateToSettings: () => void;
  onCreateAgenda: (event: SymplaEvent) => void;
}

const EventCard: React.FC<{ event: SymplaEvent; onCreateAgenda: (event: SymplaEvent) => void }> = ({ event, onCreateAgenda }) => {
    const formatDate = (dateString: string) => {
        const [date, time] = dateString.split(' ');
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year} às ${time}`;
    };

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
            <img src={event.image} alt={event.name} className="w-full h-48 object-cover" />
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-lg font-bold text-gray-800 flex-grow">{event.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p><strong>Início:</strong> {formatDate(event.start_date)}</p>
                    <p><strong>Local:</strong> {event.city} - {event.state}</p>
                </div>
                 <a href={event.url} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm text-brand-blue-dark hover:underline">
                    Ver na Sympla
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

const SymplaPage: React.FC<SymplaPageProps> = ({ symplaCredentials, onNavigateToSettings, onCreateAgenda }) => {
  const isConfigured = symplaCredentials.apiToken;
  const [events, setEvents] = useState<SymplaEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    setEvents([]);
    try {
        const fetchedEvents = await getSymplaEvents();
        setEvents(fetchedEvents);
    } catch (e: any) {
        setError(e.message || "Ocorreu um erro desconhecido ao buscar os eventos.");
    } finally {
        setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <LoadingSpinner />
                <p className="mt-2">Buscando seus eventos na Sympla...</p>
            </div>
        );
    }

    if (error) {
         return (
            <div className="text-center p-8">
                 <h2 className="mt-4 text-xl font-medium text-red-700">Falha na Conexão</h2>
                 <p className="mt-2 text-gray-500 max-w-lg">{error}</p>
            </div>
        );
    }

    if (events.length > 0) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                {events.map(event => (
                    <EventCard key={event.id} event={event} onCreateAgenda={onCreateAgenda} />
                ))}
            </div>
        );
    }

    return (
        <div className="text-center p-8">
            <TicketIcon className="mx-auto h-12 w-12 text-brand-green" />
            <h2 className="mt-4 text-xl font-medium text-gray-800">Conexão Ativa!</h2>
            <p className="mt-2 text-gray-500 max-w-lg">
                Clique no botão abaixo para buscar seus eventos publicados na Sympla e começar a criar pautas.
            </p>
        </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Curadoria de Eventos Sympla</h1>
                <p className="mt-2 text-gray-600">
                Importe eventos para criar pautas para a Agenda de forma rápida e inteligente.
                </p>
            </div>
             {isConfigured && (
                 <button
                    onClick={handleFetchEvents}
                    disabled={isLoading}
                    className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-purple hover:bg-purple-700 disabled:bg-gray-400"
                >
                    <CalendarDaysIcon className="h-5 w-5 mr-2" />
                    {isLoading ? 'Buscando...' : 'Buscar Eventos'}
                </button>
            )}
        </div>
        

        <div className="bg-white rounded-lg shadow-md min-h-[32rem] border border-gray-200 flex flex-col">
          {isConfigured ? (
            renderContent()
          ) : (
            <div className="flex-grow flex items-center justify-center text-center p-8">
              <div>
                <GearIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h2 className="mt-4 text-xl font-medium text-gray-800">Primeiro Passo: Configuração</h2>
                <p className="mt-2 text-gray-500 max-w-lg">
                  Para começar, adicione seu Token de API privado da Sympla na página de Configurações.
                </p>
                <button
                  onClick={onNavigateToSettings}
                  className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-purple hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-purple"
                >
                  Ir para Configurações
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymplaPage;
