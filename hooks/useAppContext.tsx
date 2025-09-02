import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, clearSession } from '../services/supabase';
import { UserProfile, AiPreferences, WordPressCredentials } from '../types';
import { useToast } from './useToast';

const DEFAULT_SYSTEM_INSTRUCTION = `Você é um jornalista expert e editor de SEO para o portal de notícias 'recifemais.com.br'. Seu público é o 'Conectado Recifense' (24-45 anos), interessado em cultura, serviços e acontecimentos locais.`;

interface AppContextType {
    session: any | null;
    userProfile: UserProfile | null;
    aiPreferences: AiPreferences;
    wordPressCredentials: WordPressCredentials;
    handleProfileUpdate: (newProfile: Omit<UserProfile, 'id' | 'email'>) => Promise<void>;
    handleAiPreferencesUpdate: (newPrefs: AiPreferences) => Promise<void>;
    handleWordPressCredentialsUpdate: (newCreds: WordPressCredentials) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [session, setSession] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [aiPreferences, setAiPreferences] = useState<AiPreferences>({
        tone: 'Jornalístico (Padrão)',
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        enabledProviders: [],
        preferredProvider: null,
    });
    const [wordPressCredentials, setWordPressCredentials] = useState<WordPressCredentials>({
        siteUrl: '',
        username: '',
        applicationPassword: '',
    });
    
    const { showToast } = useToast();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            console.error('Erro ao obter sessão inicial:', error);
            if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('Refresh Token Not Found')) {
              clearSession();
            }
          }
          setSession(session);
        });
    
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('Auth state changed:', event, session?.user?.email);
          setSession(session);
          
          // Se houve erro de token, limpar dados locais
          if (event === 'TOKEN_REFRESHED' && !session) {
            setUserProfile(null);
            setAiPreferences({
              tone: 'Jornalístico (Padrão)',
              systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
              enabledProviders: [],
              preferredProvider: null,
            });
            setWordPressCredentials({
              siteUrl: '',
              username: '',
              applicationPassword: '',
            });
          }
        });
    
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session?.user) {
          const fetchUserProfile = async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
    
            if (error && error.code !== 'PGRST116') {
              console.error('Error fetching user profile:', error.message);
            } else if (data) {
                const profileData = data as UserProfile;
                setUserProfile({ ...profileData, email: session.user.email });
                
                setWordPressCredentials({
                    siteUrl: profileData.wp_site_url || '',
                    username: profileData.wp_username || '',
                    applicationPassword: profileData.wp_application_password || '',
                });
    
                setAiPreferences({
                    tone: profileData.ai_tone || 'Jornalístico (Padrão)',
                    systemInstruction: profileData.ai_system_instruction || DEFAULT_SYSTEM_INSTRUCTION,
                    enabledProviders: [],
                    preferredProvider: null,
                });
    
            } else {
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  name: session.user.email?.split('@')[0] || 'Novo Usuário',
                  role: 'Editor',
                })
                .select()
                .single();
    
              if (insertError) {
                console.error('Error creating profile:', insertError.message);
              } else if(newProfile) {
                setUserProfile({ ...newProfile, email: session.user.email });
              }
            }
          };
    
          fetchUserProfile();
    
        } else {
            setUserProfile(null);
        }
    }, [session]);


    const handleProfileUpdate = async (newProfile: Omit<UserProfile, 'id' | 'email'>) => {
        if (!userProfile) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ name: newProfile.name, role: newProfile.role })
                .eq('id', userProfile.id)
                .select()
                .single();
            if (error) throw error;
            if (data) {
                setUserProfile(d => d ? {...d, name: data.name, role: data.role} : null);
                showToast('Perfil salvo com sucesso!', 'success');
            }
        } catch (error: any) {
            showToast(`Erro ao salvar perfil: ${error.message}`, 'error');
            throw error;
        }
    };
    
    const handleAiPreferencesUpdate = async (newPrefs: AiPreferences) => {
        if (!session?.user) return;
        setAiPreferences(newPrefs); // Optimistic update
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    ai_tone: newPrefs.tone,
                    ai_system_instruction: newPrefs.systemInstruction,
                })
                .eq('id', session.user.id);
            if (error) throw error;
            showToast('Preferências de IA salvas!', 'success');
        } catch (error: any) {
            showToast(`Erro ao salvar preferências: ${error.message}`, 'error');
            setAiPreferences(aiPreferences); // Revert on error
            throw error;
        }
    };
    
    const handleWordPressCredentialsUpdate = async (newCreds: WordPressCredentials) => {
        if (!session?.user) return;
        setWordPressCredentials(newCreds); // Optimistic update
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    wp_site_url: newCreds.siteUrl,
                    wp_username: newCreds.username,
                    wp_application_password: newCreds.applicationPassword,
                })
                .eq('id', session.user.id);
            if (error) throw error;
            showToast('Credenciais do WordPress salvas!', 'success');
        } catch (error: any) {
            showToast(`Erro ao salvar credenciais: ${error.message}`, 'error');
            setWordPressCredentials(wordPressCredentials); // Revert on error
            throw error;
        }
    };

    const value = {
        session,
        userProfile,
        aiPreferences,
        wordPressCredentials,
        handleProfileUpdate,
        handleAiPreferencesUpdate,
        handleWordPressCredentialsUpdate
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
