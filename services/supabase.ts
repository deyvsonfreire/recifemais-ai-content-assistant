import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuração do Supabase
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// Validação das variáveis de ambiente
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        'Supabase URL and Anon Key must be provided. Please check your .env file.\n' +
        'Required variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY'
    );
}

// Configurações do cliente Supabase
const supabaseConfig = {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce' as const,
    },
    global: {
        headers: {
            'X-Client-Info': 'recifemais-ai-assistant',
        },
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
};

// Cliente Supabase
export const supabase: SupabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    supabaseConfig
);

// Função para verificar a conexão
export const checkConnection = async (): Promise<boolean> => {
    try {
        const { data, error } = await supabase.from('profiles').select('id').limit(1);
        return !error;
    } catch (error) {
        console.error('Erro ao verificar conexão com Supabase:', error);
        return false;
    }
};

// Função para obter informações da sessão atual
export const getCurrentSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Erro ao obter sessão:', error);
        // Se o erro for de refresh token inválido, limpar a sessão
        if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('Refresh Token Not Found')) {
            await clearSession();
        }
        return null;
    }
    return session;
};

// Função para limpar a sessão local
export const clearSession = async () => {
    try {
        // Limpar dados do localStorage
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-aoyrpadrrsckxbuadcnf-auth-token');
        
        // Fazer logout no Supabase
        await supabase.auth.signOut();
        
        console.log('Sessão limpa com sucesso');
    } catch (error) {
        console.error('Erro ao limpar sessão:', error);
    }
};

// Função para obter o usuário atual
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Erro ao obter usuário:', error);
        return null;
    }
    return user;
};

// Tipos de erro personalizados
export class SupabaseError extends Error {
    constructor(
        message: string,
        public code?: string,
        public details?: any
    ) {
        super(message);
        this.name = 'SupabaseError';
    }
}

// Função helper para tratar erros do Supabase
export const handleSupabaseError = (error: any): SupabaseError => {
    if (error?.code) {
        return new SupabaseError(
            error.message || 'Erro desconhecido do Supabase',
            error.code,
            error.details
        );
    }
    return new SupabaseError(error?.message || 'Erro desconhecido');
};

export default supabase;
