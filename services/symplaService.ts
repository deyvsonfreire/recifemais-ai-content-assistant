import { SymplaEvent } from "../types";
import { supabase } from './supabase';

const handleApiError = async (response: Response) => {
    const errorData = await response.json().catch(() => ({ message: `Status: ${response.statusText}` }));
    const message = errorData.message || 'Erro desconhecido';
    throw new Error(`Erro na API da Sympla: ${message}`);
};

const formatSymplaDate = (isoDate: string | null | undefined): string => {
    if (!isoDate) return '';
    // Converts "2024-07-26T19:00:00-0300" to "2024-07-26 19:00:00"
    return isoDate.replace('T', ' ').substring(0, 19);
};

export async function getSymplaEvents(): Promise<SymplaEvent[]> {
    try {
        // Invoke the Supabase Edge Function which acts as a secure proxy
        const { data, error } = await supabase.functions.invoke('sympla-proxy');

        if (error) {
            // The edge function might return a structured error message
            const errorMessage = (error.context as any)?.error?.error || error.message;
            throw new Error(`Erro ao buscar eventos: ${errorMessage}`);
        }

        const jsonResponse = data;
        
        // The API response via proxy returns a `data` array with the events
        if (jsonResponse.data && Array.isArray(jsonResponse.data)) {
            // Map the v4 API response to our SymplaEvent interface for consistency
            return jsonResponse.data.map((item: any) => ({
                id: item.id,
                name: item.name,
                start_date: formatSymplaDate(item.start_date),
                end_date: formatSymplaDate(item.end_date),
                url: item.url,
                detail: item.summary || '', // v4 uses 'summary' instead of 'detail'
                city: item.address?.city || '',
                state: item.address?.state || '',
                image: item.image,
            }));
        } else if (jsonResponse.error) {
            throw new Error(`Erro da API da Sympla: ${jsonResponse.error}`);
        } else {
            throw new Error("A resposta da API da Sympla não contém os dados esperados.");
        }
        
    } catch (error) {
        console.error("Failed to fetch Sympla events via proxy:", error);
        if (error instanceof Error) {
            if (error.message.includes('Failed to send a request')) {
                 throw new Error(
                    "Falha de conexão com o serviço de proxy. A Edge Function 'sympla-proxy' pode não estar implantada ou o segredo 'SUPABASE_SERVICE_ROLE_KEY' pode não ter sido configurado. Por favor, siga o passo a passo completo no arquivo supabase/README.md para implantar e configurar a função corretamente."
                );
            }
            throw error; // Re-throw other formatted errors
        }
        throw new Error("Falha ao buscar eventos da Sympla.");
    }
}