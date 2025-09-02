import { WordPressCredentials, WordPressPost, WordPressTaxonomy, WordPressTerm } from "../types";

// Helper to create the Authorization header
function getAuthHeader(credentials: WordPressCredentials): string {
    const token = btoa(`${credentials.username}:${credentials.applicationPassword}`);
    return `Basic ${token}`;
}

const handleApiError = async (response: Response) => {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    const message = errorData.message || (typeof errorData.data?.params === 'string' ? errorData.data.params : response.statusText);
    throw new Error(`Erro na API do WordPress: ${message}`);
};

// New centralized fetch helper to handle CORS errors gracefully
const performFetch = async (url: string, options: RequestInit) => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) await handleApiError(response);
        return response;
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new Error(
                'Falha de conexão com o seu site. Isso geralmente é um problema de CORS no servidor WordPress. ' +
                'Solução: Instale o plugin "WP-CORS" no seu WordPress e ative o acesso para a API REST.'
            );
        }
        // Re-throw other errors
        throw error;
    }
};


// Function to discover all available API endpoints
export async function discoverApiEndpoints(credentials: WordPressCredentials): Promise<any> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const apiUrl = `${normalizedUrl}/wp-json/`;

    try {
        const response = await performFetch(apiUrl, {
            headers: { 'Authorization': getAuthHeader(credentials) },
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to discover API endpoints:", error);
        if (error instanceof Error) throw error;
        throw new Error("Falha ao descobrir os endpoints da API do WordPress.");
    }
}

// Generic function to fetch items from any CPT with pagination
export async function getCPTItems(credentials: WordPressCredentials, postType: string, page: number = 1, perPage: number = 10, status: string = 'all'): Promise<{ posts: WordPressPost[], totalPages: number, totalItems: number }> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");
    
    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    let apiUrl = `${normalizedUrl}/wp-json/wp/v2/${postType}?page=${page}&per_page=${perPage}&_embed&_fields=id,date,link,title,status,_links,_embedded`;
    
    // Add status filter if not 'all'
    if (status !== 'all') {
        apiUrl += `&status=${status}`;
    } else {
        // Include all statuses when 'all' is selected
        apiUrl += '&status=publish,draft,pending,private,future';
    }

    try {
        const response = await performFetch(apiUrl, {
            headers: { 'Authorization': getAuthHeader(credentials) },
        });
        
        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
        const totalItems = parseInt(response.headers.get('X-WP-Total') || '0', 10);
        const posts = await response.json();
        
        return { posts, totalPages, totalItems };
    } catch (error) {
        console.error(`Failed to fetch WordPress items for CPT "${postType}":`, error);
        if (error instanceof Error) throw error;
        throw new Error(`Falha ao buscar itens de "${postType}". Verifique a conexão e as configurações.`);
    }
}

// Generic function to fetch a single item by ID from any CPT
export async function getCPTItemById(credentials: WordPressCredentials, postType: string, itemId: number): Promise<WordPressPost> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    // Use context=edit to get raw fields and _embed for featured image
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/${postType}/${itemId}?context=edit&_embed`;

    try {
        const response = await performFetch(apiUrl, {
            headers: { 'Authorization': getAuthHeader(credentials) },
        });
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch WordPress item ${itemId} from CPT ${postType}:`, error);
        if (error instanceof Error) throw error;
        throw new Error(`Falha ao buscar o item de ${postType} do WordPress.`);
    }
}

// Generic function to create a new item in any CPT
export async function createCPTItem(credentials: WordPressCredentials, postType: string, itemData: Partial<WordPressPost>): Promise<WordPressPost> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");
    
    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/${postType}`;
    
    try {
        const response = await performFetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader(credentials),
            },
            body: JSON.stringify(itemData),
        });
        return await response.json();
    } catch (error) {
        console.error(`Failed to create item in CPT ${postType}:`, error);
        if (error instanceof Error) throw error;
        throw new Error(`Falha ao criar item em ${postType} no WordPress.`);
    }
}

// Generic function to update an existing item in any CPT
export async function updateCPTItem(credentials: WordPressCredentials, postType: string, itemId: number, itemData: Partial<WordPressPost>): Promise<WordPressPost> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/${postType}/${itemId}`;

    try {
        const response = await performFetch(apiUrl, {
            method: 'POST', // WordPress uses POST for updates
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getAuthHeader(credentials),
            },
            body: JSON.stringify(itemData),
        });
        return await response.json();
    } catch (error) {
        console.error(`Failed to update WordPress item ${itemId} in CPT ${postType}:`, error);
        if (error instanceof Error) throw error;
        throw new Error(`Falha ao atualizar o item em ${postType} no WordPress.`);
    }
}

// Generic function to delete an item from any CPT
export async function deleteCPTItem(credentials: WordPressCredentials, postType: string, postId: number): Promise<void> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/${postType}/${postId}?force=true`;

    try {
        await performFetch(apiUrl, {
            method: 'DELETE',
            headers: { 'Authorization': getAuthHeader(credentials) },
        });
    } catch (error) {
        console.error(`Failed to delete WordPress item ${postId} from CPT "${postType}":`, error);
        if (error instanceof Error) throw error;
        throw new Error(`Falha ao excluir o item de "${postType}".`);
    }
}

// Function to fetch all public taxonomies
export async function getTaxonomies(credentials: WordPressCredentials): Promise<Record<string, WordPressTaxonomy>> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/taxonomies`;

    try {
        const response = await performFetch(apiUrl, {
            headers: { 'Authorization': getAuthHeader(credentials) },
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch WordPress taxonomies:", error);
        if (error instanceof Error) throw error;
        throw new Error("Falha ao buscar taxonomias do WordPress.");
    }
}

// Function to fetch all terms for a given taxonomy
export async function getTerms(credentials: WordPressCredentials, taxonomyRestBase: string): Promise<WordPressTerm[]> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    // Fetch all terms, up to 100 which should cover most cases
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/${taxonomyRestBase}?per_page=100`;

    try {
        const response = await performFetch(apiUrl, {
            headers: { 'Authorization': getAuthHeader(credentials) },
        });
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch terms for ${taxonomyRestBase}:`, error);
        if (error instanceof Error) throw error;
        throw new Error(`Falha ao buscar termos para ${taxonomyRestBase}.`);
    }
}

// Function to upload media
export async function uploadMedia(credentials: WordPressCredentials, file: File): Promise<{ id: number, source_url: string }> {
    const { siteUrl } = credentials;
    if (!siteUrl) throw new Error("A URL do site WordPress não está definida.");

    const normalizedUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const apiUrl = `${normalizedUrl}/wp-json/wp/v2/media`;

    try {
        const response = await performFetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(credentials),
                'Content-Type': file.type,
                'Content-Disposition': `attachment; filename="${file.name}"`
            },
            body: file,
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to upload media to WordPress:", error);
        if (error instanceof Error) throw error;
        throw new Error("Falha ao enviar a imagem para o WordPress.");
    }
}
