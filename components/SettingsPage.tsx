import React, { useState, useEffect } from 'react';
import { UserProfile, AiPreferences, WordPressCredentials } from '../types';
import { SparklesIcon, UserCircleIcon, WordPressIcon } from './ui/icons/Icons';
import { discoverApiEndpoints } from '../services/wordpressService';
import { useAppContext } from '../hooks/useAppContext';
import AIProvidersConfig from './AIProvidersConfig';

const ApiExplorer: React.FC<{ credentials: WordPressCredentials }> = ({ credentials }) => {
    const [endpoints, setEndpoints] = useState<Record<string, any> | null>(null);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleDiscover = async () => {
        setIsDiscovering(true);
        setError(null);
        setEndpoints(null);
        try {
            const data = await discoverApiEndpoints(credentials);
            // Filter to show only relevant namespaces for clarity
            const relevantRoutes = Object.fromEntries(
                Object.entries(data.routes).filter(([route]) => 
                    route.startsWith('/wp/v2') || route.startsWith('/jet-engine')
                )
            );
            setEndpoints(relevantRoutes);
        } catch (e: any) {
            setError(e.message || "Falha ao mapear endpoints.");
        } finally {
            setIsDiscovering(false);
        }
    };
    
    const getMethodColor = (method: string) => {
        switch(method) {
            case 'GET': return 'text-green-400 bg-green-900/50';
            case 'POST': return 'text-blue-400 bg-blue-900/50';
            case 'PUT':
            case 'PATCH': return 'text-yellow-400 bg-yellow-900/50';
            case 'DELETE': return 'text-red-400 bg-red-900/50';
            default: return 'text-gray-400 bg-gray-700';
        }
    };


    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={handleDiscover}
                disabled={isDiscovering || !credentials.siteUrl}
                className="flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-blue-dark hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-purple disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isDiscovering ? 'Mapeando...' : 'Mapear Endpoints da API'}
            </button>
            
            {isDiscovering && (
                 <div className="mt-4 text-sm text-gray-500">Buscando rotas na API...</div>
            )}
            {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                    <strong>Erro:</strong> {error}
                </div>
            )}
            {endpoints && (
                <div className="mt-4 p-4 bg-gray-800 text-white rounded-md max-h-96 overflow-auto font-mono text-xs shadow-inner">
                    <p className="text-gray-400 mb-4">// Endpoints encontrados (wp/v2 e jet-engine):</p>
                    {Object.entries(endpoints).map(([route, details]) => (
                        <div key={route} className="mb-3 pb-2 border-b border-gray-700 last:border-b-0">
                             <p className="text-gray-300 break-all">{route}</p>
                             <div className="pl-2 flex flex-wrap gap-2 mt-1">
                                {details.methods.map((method: string) => (
                                    <span key={method} className={`px-2 py-0.5 rounded-md text-xs font-semibold ${getMethodColor(method)}`}>
                                        {method}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const SettingsPage: React.FC = () => {
    const {
        userProfile,
        aiPreferences,
        wordPressCredentials,
        handleProfileUpdate,
        handleAiPreferencesUpdate,
        handleWordPressCredentialsUpdate
    } = useAppContext();

    const [profile, setProfile] = useState({ name: '', role: '' });
    const [prefs, setPrefs] = useState<AiPreferences>(aiPreferences);
    const [wpCreds, setWpCreds] = useState<WordPressCredentials>(wordPressCredentials);

    useEffect(() => {
        if (userProfile) {
            setProfile({ name: userProfile.name, role: userProfile.role });
        }
    }, [userProfile]);

    useEffect(() => { setPrefs(aiPreferences); }, [aiPreferences]);
    useEffect(() => { setWpCreds(wordPressCredentials); }, [wordPressCredentials]);


    const handleProfileSave = (e: React.FormEvent) => {
        e.preventDefault();
        handleProfileUpdate(profile).catch(() => {}); // Errors handled by context
    };

    const handlePrefsSave = (e: React.FormEvent) => {
        e.preventDefault();
        handleAiPreferencesUpdate(prefs).catch(() => {});
    };

    const handleWpCredsSave = (e: React.FormEvent) => {
        e.preventDefault();
        handleWordPressCredentialsUpdate(wpCreds).catch(() => {});
    };

    const inputClasses = "block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 mb-1";
    const buttonClasses = "w-full sm:w-auto flex justify-center items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red disabled:bg-gray-400";

    if (!userProfile) {
        return null; // or a loading state
    }

    return (
        <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-full">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
                <p className="mt-2 text-gray-600">
                    Gerencie suas informações de perfil e ajuste as preferências do Assistente de IA.
                </p>

                {/* User Profile Section */}
                <form onSubmit={handleProfileSave} className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <UserCircleIcon className="h-6 w-6 text-gray-500 mr-3" />
                        <h2 className="text-xl font-bold text-gray-800">Perfil do Usuário</h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Estas informações são exibidas na barra lateral.</p>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="fullName" className={labelClasses}>Nome Completo</label>
                            <input
                                type="text"
                                id="fullName"
                                value={profile.name}
                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label htmlFor="role" className={labelClasses}>Cargo</label>
                            <input
                                type="text"
                                id="role"
                                value={profile.role}
                                onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                                className={inputClasses}
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                        <div className="text-sm text-gray-500">Email: {userProfile.email}</div>
                        <div className="flex items-center w-full sm:w-auto">
                            <button type="submit" className={buttonClasses}>Salvar Perfil</button>
                        </div>
                    </div>
                </form>

                {/* WordPress Integration Section */}
                <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <WordPressIcon className="h-6 w-6 text-brand-blue-dark mr-3" />
                        <h2 className="text-xl font-bold text-gray-800">Integração WordPress</h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Conecte-se ao seu site para publicar rascunhos diretamente.</p>
                    <form onSubmit={handleWpCredsSave} className="mt-6 space-y-4">
                        <div>
                            <label htmlFor="wpUrl" className={labelClasses}>URL do Site WordPress</label>
                            <input
                                type="url" id="wpUrl" placeholder="https://recifemais.com.br"
                                value={wpCreds.siteUrl}
                                onChange={(e) => setWpCreds({ ...wpCreds, siteUrl: e.target.value.trim() })}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label htmlFor="wpUser" className={labelClasses}>Nome de Usuário</label>
                            <input
                                type="text" id="wpUser"
                                value={wpCreds.username}
                                onChange={(e) => setWpCreds({ ...wpCreds, username: e.target.value.trim() })}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label htmlFor="wpAppPass" className={labelClasses}>Senha de Aplicativo</label>
                            <p className="text-xs text-gray-500 mb-2">
                                Gere uma "Senha de Aplicativo" no seu perfil de usuário do WordPress para uma conexão segura.
                            </p>
                            <input
                                type="password" id="wpAppPass"
                                value={wpCreds.applicationPassword}
                                onChange={(e) => setWpCreds({ ...wpCreds, applicationPassword: e.target.value.trim() })}
                                className={inputClasses}
                            />
                        </div>
                        <div className="!mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-900">
                            <p className="font-bold">Nota sobre Conexão (CORS)</p>
                            <p className="text-sm mt-1">
                                Se você encontrar erros de "Falha de conexão", seu site WordPress pode estar bloqueando solicitações externas. Para resolver, instale o plugin <a href="https://wordpress.org/plugins/wp-cors/" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-yellow-950">WP-CORS</a> no seu WordPress e ative o acesso para a API REST.
                            </p>
                        </div>
                        <div className="mt-6 flex items-center justify-end">
                            <button type="submit" className={buttonClasses}>Salvar Conexão</button>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-700">API Endpoint Explorer</h3>
                        <p className="mt-1 text-sm text-gray-500">Mapeie todos os endpoints disponíveis na sua API REST, incluindo Custom Post Types (CPTs) do JetEngine.</p>
                        <ApiExplorer credentials={wordPressCredentials} />
                    </div>
                </div>

                {/* AI Preferences Section */}
                <form onSubmit={handlePrefsSave} className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <SparklesIcon className="h-6 w-6 text-brand-purple mr-3" />
                        <h2 className="text-xl font-bold text-gray-800">Preferências do Assistente IA</h2>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Personalize o comportamento principal do modelo de IA.</p>
                    <div className="mt-6 space-y-6">
                        <div>
                            <label htmlFor="tone" className={labelClasses}>Tom de Voz (Em breve)</label>
                            <select id="tone" value={prefs.tone} disabled className={`${inputClasses} bg-gray-100 cursor-not-allowed`}>
                                <option>Jornalístico (Padrão)</option>
                                <option>Entusiasmado</option>
                                <option>Formal</option>
                                <option>Casual</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="systemInstruction" className={labelClasses}>
                                Instrução do Sistema
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Esta é a instrução principal que define a persona e o objetivo da IA. Edite com cuidado.
                            </p>
                            <textarea
                                id="systemInstruction"
                                rows={5}
                                value={prefs.systemInstruction}
                                onChange={(e) => setPrefs({ ...prefs, systemInstruction: e.target.value })}
                                className={inputClasses}
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex items-center justify-end">
                        <button type="submit" className={buttonClasses}>Salvar Preferências de IA</button>
                    </div>
                </form>

                {/* AI Providers Configuration Section */}
                <div className="mt-8">
                    <AIProvidersConfig onConfigChange={() => {
                        // Opcional: atualizar estado ou notificar mudanças
                        console.log('Configuração de provedores de IA atualizada');
                    }} />
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
