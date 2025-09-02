import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AiGenerator from './components/AiGenerator';
import SettingsPage from './components/SettingsPage';
import CptManagerPage from './components/CptManagerPage';
import PostEditor from './components/PostEditor';
import LugarEditor from './components/LugarEditor';
import AgendaEditor from './components/AgendaEditor';
import ArtistaEditor from './components/ArtistaEditor';
import HistoriaEditor from './components/HistoriaEditor';
import OrganizadorEditor from './components/OrganizadorEditor';
import LoginPage from './components/LoginPage';
import GoogleEventsPage from './components/GoogleEventsPage';
import ScrapedEventsPage from './components/ScrapedEventsPage';
import { Page, GoogleEvent, InitialAgendaData, InitialHistoriaData, InitialOrganizadorData, InitialPostData } from './types';
import { BarChartIcon, MagicWandIcon } from './components/icons/Icons';
import { ToastProvider } from './hooks/useToast';
import { AppProvider, useAppContext } from './hooks/useAppContext';
import AIProvidersStatus from './components/AIProvidersStatus';

const AppContent: React.FC = () => {
  const { session, userProfile, aiPreferences, wordPressCredentials } = useAppContext();
  const [activePage, setActivePage] = useState<Page>(Page.Dashboard);

  // State to handle navigation with data, e.g., "create post from draft"
  const [navigationData, setNavigationData] = useState<any>(null);

  useEffect(() => {
    // If we have navigation data, switch to the correct page
    if (navigationData) {
      if (navigationData.type === 'noticia') setActivePage(Page.Noticias);
      if (navigationData.type === 'historia') setActivePage(Page.Historias);
      if (navigationData.type === 'organizador') setActivePage(Page.Organizadores);
      if (navigationData.type === 'agenda') setActivePage(Page.Agenda);
    }
  }, [navigationData]);
  
  // Clear navigation data when page changes away from the target
  useEffect(() => {
    if (activePage !== Page.Noticias && navigationData?.type === 'noticia') setNavigationData(null);
    if (activePage !== Page.Historias && navigationData?.type === 'historia') setNavigationData(null);
    if (activePage !== Page.Organizadores && navigationData?.type === 'organizador') setNavigationData(null);
    if (activePage !== Page.Agenda && navigationData?.type === 'agenda') setNavigationData(null);
  }, [activePage, navigationData]);


  const handleCreatePostFromDraft = (draftData: InitialPostData) => {
    setNavigationData({ type: 'noticia', data: draftData });
  };
  const handleCreateHistoriaFromDraft = (draftData: InitialHistoriaData) => {
    setNavigationData({ type: 'historia', data: draftData });
  };
  const handleCreateOrganizadorFromDraft = (draftData: InitialOrganizadorData) => {
    setNavigationData({ type: 'organizador', data: draftData });
  };
  const handleCreateAgendaFromGoogleEvent = (event: GoogleEvent) => {
    const [date, time] = event.start_date.split(' ');
    const initialContent = `
        <p>O evento <strong>${event.name}</strong> acontecerá em ${event.venue || event.location}.</p>
        <p>${event.summary}</p>
        <p>Mais informações na <a href="${event.source_url}" target="_blank" rel="noopener noreferrer">página oficial do evento</a>.</p>
    `;
    const initialData: InitialAgendaData = {
        title: event.name,
        content: initialContent,
        eventDate: date,
        eventTime: time,
    };
    setNavigationData({ type: 'agenda', data: initialData });
  };

  const CptHost: React.FC<{
    postType: string;
    postTypeName: string;
    EditorComponent: React.FC<any>;
    expectedNavType: string;
  }> = ({ postType, postTypeName, EditorComponent, expectedNavType }) => {
    const [view, setView] = useState<'list' | 'edit' | 'create'>(navigationData?.type === expectedNavType ? 'create' : 'list');
    const [currentId, setCurrentId] = useState<number | null>(null);
    
    // Handle external data triggers for creation
    const initialData = navigationData?.type === expectedNavType ? navigationData.data : null;

    useEffect(() => {
      // If we land on this page with data, ensure we are in 'create' view
      if (initialData) {
        setView('create');
      }
    }, [initialData]);

    const handleCreate = () => {
      setCurrentId(null);
      setView('create');
    };
    const handleEdit = (id: number) => {
      setCurrentId(id);
      setView('edit');
    };
    const handleBackToList = () => {
      setCurrentId(null);
      setNavigationData(null); // Clear nav data when returning to list
      setView('list');
    };
    
    switch (view) {
        case 'create':
            return <EditorComponent onSave={handleBackToList} onCancel={handleBackToList} initialData={initialData} wordPressCredentials={wordPressCredentials} />;
        case 'edit':
             // Map generic postId to specific prop for each editor
            const editorProps = {
                [postType + 'Id']: currentId,
                postId: currentId,
                agendaId: currentId,
                lugarId: currentId,
                artistaId: currentId,
                historiaId: currentId,
                organizadorId: currentId,
            };
            return <EditorComponent {...editorProps} onSave={handleBackToList} onCancel={handleBackToList} wordPressCredentials={wordPressCredentials} />;
        case 'list':
        default:
            return <CptManagerPage postType={postType} postTypeName={postTypeName} onCreate={handleCreate} onEdit={handleEdit} wordPressCredentials={wordPressCredentials} />;
    }
  };

  const renderContent = () => {
    switch (activePage) {
      case Page.Dashboard:
        return <DashboardPlaceholder />;
      case Page.AIAssistant:
        return <AiGenerator
          aiPreferences={aiPreferences}
          wordPressCredentials={wordPressCredentials}
          onSendToNoticiaEditor={handleCreatePostFromDraft}
          onSendToHistoriaEditor={handleCreateHistoriaFromDraft}
          onSendToOrganizadorEditor={handleCreateOrganizadorFromDraft}
        />;
      case Page.EventSearch:
        return <GoogleEventsPage onCreateAgenda={handleCreateAgendaFromGoogleEvent} />;
      case Page.ScrapedEvents:
        return <ScrapedEventsPage onCreateAgenda={handleCreateAgendaFromGoogleEvent} />;
      case Page.Noticias:
        return <CptHost postType="posts" postTypeName="Notícias" EditorComponent={PostEditor} expectedNavType='noticia' />;
      case Page.Agenda:
         return <CptHost postType="agenda" postTypeName="Agenda" EditorComponent={AgendaEditor} expectedNavType='agenda'/>;
      case Page.Artistas:
        return <CptHost postType="artista" postTypeName="Artistas" EditorComponent={ArtistaEditor} expectedNavType='artista' />;
      case Page.Historias:
        return <CptHost postType="historia" postTypeName="Histórias" EditorComponent={HistoriaEditor} expectedNavType='historia' />;
      case Page.Organizadores:
        return <CptHost postType="organizador" postTypeName="Organizadores" EditorComponent={OrganizadorEditor} expectedNavType='organizador' />;
      case Page.Lugares:
        return <CptHost postType="lugar" postTypeName="Lugares" EditorComponent={LugarEditor} expectedNavType='lugar' />;
      case Page.Settings:
        return userProfile ? <SettingsPage /> : null;
      default:
        return <DashboardPlaceholder />;
    }
  };

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        userProfile={userProfile}
      />
      <main className="flex-1 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppProvider>
      <AppContent />
    </AppProvider>
  </ToastProvider>
);


const DashboardPlaceholder: React.FC = () => (
  <div className="p-10">
    <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
    
    {/* Status dos Provedores de IA */}
    <div className="mt-6">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Status dos Provedores de IA</h2>
      <AIProvidersStatus />
    </div>
    
    <div className="mt-8 flex items-center justify-center bg-white rounded-lg shadow-md h-96 border border-gray-200">
      <div className="text-center">
        <BarChartIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h2 className="mt-2 text-lg font-medium text-gray-700">Dashboard em Construção</h2>
        <p className="mt-1 text-sm text-gray-500">Métricas de performance e conteúdo aparecerão aqui.</p>
        <div className="mt-6 flex items-center justify-center text-sm text-gray-500">
          <MagicWandIcon className="h-5 w-5 mr-2 text-brand-purple" />
          <span>Experimente o Assistente IA no menu ao lado!</span>
        </div>
      </div>
    </div>
  </div>
);

export default App;