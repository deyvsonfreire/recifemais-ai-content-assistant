import React, { useState, useEffect, useCallback } from 'react';
import { WordPressCredentials, WordPressPost, InitialAgendaData } from '../types';
import { createCPTItem, getCPTItemById, updateCPTItem, uploadMedia, getCPTItems } from '../services/wordpressService';
import { searchPlaceInformation } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import ImageCropperModal from './ImageCropperModal';
import SimpleModal from './SimpleModal';
import { CameraIcon, ImageIcon, PlusIcon, MagicWandIcon } from './icons/Icons';
import { useToast } from '../hooks/useToast';
import { useQuillEditor } from '../hooks/useQuillEditor';

interface AgendaEditorProps {
    agendaId?: number;
    initialData?: InitialAgendaData | null;
    wordPressCredentials: WordPressCredentials;
    onSave: () => void;
    onCancel: () => void;
}

const QuickCreateLugarForm: React.FC<{
    wordPressCredentials: WordPressCredentials;
    onClose: () => void;
    onSuccess: (newItem: WordPressPost) => void;
}> = ({ wordPressCredentials, onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [endereco, setEndereco] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [estado, setEstado] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchingWithAI, setIsSearchingWithAI] = useState(false);
    const [error, setError] = useState('');
    const { showToast } = useToast();

    const handleSearchPlace = async () => {
        if (!title.trim()) {
            showToast('Digite o nome do local para buscar.', 'info');
            return;
        }
        setIsSearchingWithAI(true);
        try {
            const { draft } = await searchPlaceInformation(title);
            if (draft) {
                setEndereco(draft.address || '');
                setBairro(draft.neighborhood || '');
                setCidade(draft.city || '');
                setEstado(draft.state || '');
                showToast('Dados do local preenchidos!', 'success');
            } else {
                showToast('Nenhuma informação encontrada.', 'info');
            }
        } catch (e: any) {
            showToast(`Erro na busca: ${e.message}`, 'error');
        } finally {
            setIsSearchingWithAI(false);
        }
    };

    const handleSave = async () => {
        if (!title) {
            setError('O nome do local é obrigatório.');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const newItem = await createCPTItem(wordPressCredentials, 'lugar', {
                title,
                status: 'publish',
                meta: { 
                    endereco,
                    bairro,
                    cidade,
                    estado
                },
            } as any);
            showToast('Novo local criado com sucesso!', 'success');
            onSuccess(newItem);
        } catch (e: any) {
            setError(e.message || 'Falha ao criar o local.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
                <label htmlFor="new-lugar-title" className="block text-sm font-medium text-gray-700">Nome do Local</label>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input 
                        type="text" id="new-lugar-title" value={title} 
                        onChange={e => setTitle(e.target.value)} 
                        className="flex-grow block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                    <button
                        type="button"
                        onClick={handleSearchPlace}
                        disabled={isSearchingWithAI || !title.trim()}
                        className="flex-shrink-0 flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-recife-creative hover:bg-purple-700 disabled:bg-gray-400"
                    >
                         <MagicWandIcon className="h-4 w-4 mr-1" />
                         <span>{isSearchingWithAI ? '...' : 'Buscar'}</span>
                    </button>
                </div>
            </div>
            <div>
                <label htmlFor="new-lugar-endereco" className="block text-sm font-medium text-gray-700">Endereço</label>
                <input type="text" id="new-lugar-endereco" value={endereco} onChange={e => setEndereco(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm" />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div>
                    <label htmlFor="new-lugar-bairro" className="block text-sm font-medium text-gray-700">Bairro</label>
                    <input type="text" id="new-lugar-bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="new-lugar-cidade" className="block text-sm font-medium text-gray-700">Cidade</label>
                    <input type="text" id="new-lugar-cidade" value={cidade} onChange={e => setCidade(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                </div>
                 <div>
                    <label htmlFor="new-lugar-estado" className="block text-sm font-medium text-gray-700">Estado</label>
                    <input type="text" id="new-lugar-estado" value={estado} onChange={e => setEstado(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button onClick={onClose} type="button" className="px-4 py-2 text-sm font-medium bg-white border rounded-md">Cancelar</button>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-recife-red rounded-md disabled:bg-gray-400">{isSaving ? 'Salvando...' : 'Salvar Local'}</button>
            </div>
        </div>
    );
};

const AgendaEditor: React.FC<AgendaEditorProps> = ({ agendaId, initialData, wordPressCredentials, onSave, onCancel }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<WordPressPost['status']>('draft');
    
    // Meta Fields
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventTickets, setEventTickets] = useState('');

    // Relationships
    const [availableLugares, setAvailableLugares] = useState<WordPressPost[]>([]);
    const [availableArtistas, setAvailableArtistas] = useState<WordPressPost[]>([]);
    const [selectedLugarId, setSelectedLugarId] = useState<number | null>(null);
    const [selectedArtistaIds, setSelectedArtistaIds] = useState<number[]>([]);
    
    const [isLugarModalOpen, setLugarModalOpen] = useState(false);
    
    const { editorRef, initializeQuill, setContent: setQuillContent } = useQuillEditor('Descreva o evento...');

    const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const { showToast } = useToast();
    const isEditing = agendaId !== undefined;

    useEffect(() => {
        initializeQuill(setContent);
    }, [initializeQuill]);

    const fetchRelatedPosts = useCallback(async () => {
        if (!wordPressCredentials.siteUrl || !wordPressCredentials.username || !wordPressCredentials.applicationPassword) {
            return;
        }
        try {
            const [lugaresData, artistasData] = await Promise.all([
                getCPTItems(wordPressCredentials, 'lugar', 1, 100),
                getCPTItems(wordPressCredentials, 'artista', 1, 100)
            ]);
            setAvailableLugares(lugaresData.posts);
            setAvailableArtistas(artistasData.posts);
        } catch (error: any) {
            console.error("Failed to fetch related posts", error);
            showToast("Falha ao carregar locais e artistas.", "error");
        }
    }, [wordPressCredentials, showToast]);

    useEffect(() => {
        fetchRelatedPosts();
    }, [fetchRelatedPosts]);
    
     useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setContent(initialData.content);
            // Add a small delay to ensure Quill is fully initialized before setting content
            setTimeout(() => {
                setQuillContent(initialData.content);
            }, 100);
            setEventDate(initialData.eventDate);
            setEventTime(initialData.eventTime);
        }
    }, [initialData, setQuillContent]);
    
    useEffect(() => {
        const fetchAgendaData = async () => {
            if (!isEditing || !wordPressCredentials.siteUrl) return;
            setIsLoading(true);
            try {
                const agenda = await getCPTItemById(wordPressCredentials, 'agenda', agendaId);
                setTitle(agenda.title.rendered);
                const postContent = agenda.content?.raw || '';
                setContent(postContent);
                // Add a small delay to ensure Quill is fully initialized before setting content
                setTimeout(() => {
                    setQuillContent(postContent);
                }, 100);
                setStatus(agenda.status);
                
                setEventDate(agenda.meta?.data_do_evento || '');
                setEventTime(agenda.meta?.horario_do_evento || '');
                setEventTickets(agenda.meta?.ingressos_evento || '');
                
                setSelectedLugarId(agenda.meta?.local_do_evento ? Number(agenda.meta.local_do_evento) : null);
                setSelectedArtistaIds(agenda.meta?.artistas_do_evento || []);

                const featuredMedia = agenda._embedded?.['wp:featuredmedia']?.[0];
                if (featuredMedia) setFeaturedImageUrl(featuredMedia.source_url);
            } catch (e: any) {
                showToast(e.message || 'Falha ao carregar dados da agenda.', "error");
            } finally {
                setIsLoading(false);
            }
        };

        if (isEditing) {
            fetchAgendaData();
        }
    }, [agendaId, isEditing, wordPressCredentials, showToast, setQuillContent]);


    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => setImageToCrop(event.target?.result as string);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleCropComplete = (blob: Blob) => {
        const file = new File([blob], "featured-image.webp", { type: "image/webp" });
        setCroppedImageFile(file);
        setFeaturedImageUrl(URL.createObjectURL(file));
        setImageToCrop(null);
    };
    
    const handleLugarCreated = (newLugar: WordPressPost) => {
        setAvailableLugares(prev => [...prev, newLugar]);
        setSelectedLugarId(newLugar.id);
        setLugarModalOpen(false);
    };

    const handleArtistaToggle = (artistaId: number) => {
        setSelectedArtistaIds(prev =>
            prev.includes(artistaId)
                ? prev.filter(id => id !== artistaId)
                : [...prev, artistaId]
        );
    };


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let featuredMediaId: number | undefined;
            if (croppedImageFile) {
                const uploadedMedia = await uploadMedia(wordPressCredentials, croppedImageFile);
                featuredMediaId = uploadedMedia.id;
            }
            
            const itemData: any = { 
                title, 
                content, 
                status,
                meta: {
                    data_do_evento: eventDate,
                    horario_do_evento: eventTime,
                    ingressos_evento: eventTickets,
                    local_do_evento: selectedLugarId,
                    artistas_do_evento: selectedArtistaIds,
                },
            };
            if (featuredMediaId) itemData.featured_media = featuredMediaId;

            if (isEditing) {
                await updateCPTItem(wordPressCredentials, 'agenda', agendaId, itemData);
                showToast('Evento atualizado com sucesso!', 'success');
            } else {
                await createCPTItem(wordPressCredentials, 'agenda', itemData);
                showToast('Evento criado com sucesso!', 'success');
            }
            onSave();
        } catch (e: any) {
            showToast(e.message || 'Ocorreu um erro ao salvar o evento.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Carregando editor...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
            {imageToCrop && <ImageCropperModal imageSrc={imageToCrop} onClose={() => setImageToCrop(null)} onCropComplete={handleCropComplete} />}
            
            <SimpleModal isOpen={isLugarModalOpen} onClose={() => setLugarModalOpen(false)} title="Criar Novo Local" footer={<></>}>
                <QuickCreateLugarForm wordPressCredentials={wordPressCredentials} onClose={() => setLugarModalOpen(false)} onSuccess={handleLugarCreated} />
            </SimpleModal>

            <form onSubmit={handleSave}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Editar Evento' : 'Criar Novo Evento'}</h1>
                    <div className="flex items-center space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium bg-white border rounded-md">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-recife-red rounded-md disabled:bg-gray-400">
                            {isSaving ? <><LoadingSpinner /> Salvando...</> : 'Salvar Evento'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Nome do Evento</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md sm:text-lg" required />
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Evento</label>
                            <div ref={editorRef} style={{ minHeight: '250px' }}></div>
                        </div>
                         <div className="bg-white p-6 rounded-lg shadow-sm border grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                <input type="date" id="eventDate" value={eventDate} onChange={e => setEventDate(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md"/>
                            </div>
                            <div>
                                <label htmlFor="eventTime" className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                                <input type="text" id="eventTime" value={eventTime} onChange={e => setEventTime(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" placeholder="ex: 20:00"/>
                            </div>
                            <div>
                                <label htmlFor="eventTickets" className="block text-sm font-medium text-gray-700 mb-1">Ingressos</label>
                                <input type="text" id="eventTickets" value={eventTickets} onChange={e => setEventTickets(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" placeholder="ex: R$ 50 ou Gratuito"/>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border">
                            <h3 className="text-lg font-medium mb-4">Publicação</h3>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select id="status" value={status} onChange={e => setStatus(e.target.value as WordPressPost['status'])} className="block w-full p-2 border-gray-300 rounded-md">
                                <option value="draft">Rascunho</option>
                                <option value="publish">Publicado</option>
                            </select>
                        </div>
                         <div className="bg-white p-5 rounded-lg shadow-sm border">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-medium">Local</h3>
                                <button type="button" onClick={() => setLugarModalOpen(true)} className="p-1 text-recife-red hover:bg-red-50 rounded-full"><PlusIcon className="h-5 w-5"/></button>
                            </div>
                            <select value={selectedLugarId || ''} onChange={e => setSelectedLugarId(Number(e.target.value))} className="block w-full p-2 border-gray-300 rounded-md">
                                <option value="">Selecione um local</option>
                                {availableLugares.map(lugar => <option key={lugar.id} value={lugar.id}>{lugar.title.rendered}</option>)}
                            </select>
                        </div>
                        <div className="bg-white p-5 rounded-lg shadow-sm border">
                             <h3 className="text-lg font-medium mb-2">Artistas</h3>
                             <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2 bg-gray-50">
                                {availableArtistas.map(artista => (
                                    <div key={artista.id} className="flex items-center">
                                        <input id={`artista-${artista.id}`} type="checkbox" checked={selectedArtistaIds.includes(artista.id)} onChange={() => handleArtistaToggle(artista.id)} className="h-4 w-4 rounded border-gray-300 text-recife-red focus:ring-recife-red"/>
                                        <label htmlFor={`artista-${artista.id}`} className="ml-2 text-sm text-gray-700">{artista.title.rendered}</label>
                                    </div>
                                ))}
                             </div>
                        </div>
                        <div className="bg-white p-5 rounded-lg shadow-sm border">
                            <h3 className="text-lg font-medium mb-2">Imagem Destacada</h3>
                            <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                                {featuredImageUrl ? <img src={featuredImageUrl} alt="Featured" className="w-full h-full object-cover rounded-md" /> : <div className="text-gray-500 text-center"><ImageIcon className="mx-auto h-10 w-10" /><p className="mt-2 text-sm">Nenhuma imagem</p></div>}
                            </div>
                            <label htmlFor="image-upload" className="mt-4 w-full cursor-pointer flex justify-center items-center px-4 py-2 border text-sm font-medium rounded-md bg-white hover:bg-gray-50">
                               <CameraIcon className="h-5 w-5 mr-2" /><span>{featuredImageUrl ? 'Trocar' : 'Enviar Imagem'}</span>
                            </label>
                            <input id="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageSelect}/>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default AgendaEditor;
