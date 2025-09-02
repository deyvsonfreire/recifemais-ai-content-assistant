
import React from 'react';
import { Page, UserProfile } from '../types';
import { BarChartIcon, DocumentTextIcon, GearIcon, HomeIcon, MagicWandIcon, CalendarDaysIcon, UsersIcon, BookOpenIcon, BuildingOfficeIcon, MapPinIcon, MagnifyingGlassIcon, ArchiveBoxArrowDownIcon } from './icons/Icons';
import { supabase } from '../services/supabase';
import AIProvidersStatus from './AIProvidersStatus';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  userProfile: UserProfile | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, userProfile }) => {
  const navItems = [
    { name: Page.Dashboard, icon: <HomeIcon className="h-6 w-6" /> },
    { name: Page.AIAssistant, icon: <MagicWandIcon className="h-6 w-6" /> },
    { name: Page.EventSearch, icon: <MagnifyingGlassIcon className="h-6 w-6" /> },
    { name: Page.ScrapedEvents, icon: <ArchiveBoxArrowDownIcon className="h-6 w-6" /> },
    { name: Page.Noticias, icon: <DocumentTextIcon className="h-6 w-6" /> },
    { name: Page.Agenda, icon: <CalendarDaysIcon className="h-6 w-6" /> },
    { name: Page.Artistas, icon: <UsersIcon className="h-6 w-6" /> },
    { name: Page.Historias, icon: <BookOpenIcon className="h-6 w-6" /> },
    { name: Page.Organizadores, icon: <BuildingOfficeIcon className="h-6 w-6" /> },
    { name: Page.Lugares, icon: <MapPinIcon className="h-6 w-6" /> },
    { name: Page.Settings, icon: <GearIcon className="h-6 w-6" /> },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="flex items-center justify-center h-20 border-b border-gray-200">
         <h1 className="text-2xl font-bold text-brand-red">Recife<span className="text-gray-800">Mais</span></h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <a
            key={item.name}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActivePage(item.name);
            }}
            className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
              activePage === item.name
                ? 'bg-brand-purple text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {React.cloneElement(item.icon, { className: 'h-5 w-5 mr-3' })}
            {item.name}
          </a>
        ))}
      </nav>
      <div className="px-4 py-6 border-t border-gray-200">
        <div className="flex items-center">
            <img className="h-10 w-10 rounded-full object-cover" src={`https://ui-avatars.com/api/?name=${userProfile?.name || 'User'}&background=FF2230&color=fff`} alt="User avatar" />
            <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-gray-800">{userProfile?.name || 'Carregando...'}</p>
                <p className="text-xs text-gray-500">{userProfile?.role || '...'}</p>
            </div>
        </div>
        
        {/* Status dos Provedores de IA */}
        <div className="mt-4 relative">
          <AIProvidersStatus />
        </div>
        
        <button
            onClick={handleSignOut}
            className="w-full mt-4 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
            Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;