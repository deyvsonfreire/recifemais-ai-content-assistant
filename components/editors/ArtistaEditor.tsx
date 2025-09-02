import React, { useState, useEffect } from 'react';
import { WordPressPost } from '../../types';
import { createCPTItem, getCPTItemById, updateCPTItem, uploadMedia } from '../../services/wordpressService';
import LoadingSpinner from '../ui/LoadingSpinner';
import ImageCropperModal from '../ui/ImageCropperModal';
import { CameraIcon, ImageIcon, PlusIcon, TrashIcon } from '../ui/icons/Icons';
import { useToast } from '../../hooks/useToast';
import { useQuillEditor } from '../../hooks/useQuillEditor';
import { useAppContext } from '../../hooks/useAppContext';

interface ArtistaEditorProps {
    artistaId?: number;
    onSave: () => void;
    onCancel: () => void;
}

// Fix: Added missing RepeaterField helper component. Its absence caused a parsing error, leading to the component's return type being inferred as 'void' and the module's default export not being found.
// Helper component for repeater fields
const RepeaterField: React.FC<{
    label: string;
    items: string[];
    setItems: React.Dispatch<React.SetStateAction<string[]>>;
    placeholder?: string;
}> = ({ label, items, setItems, placeholder }) => {
    
    const handleItemChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index] = value;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, '']);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        } else {
            setItems(['']); // Always keep one input field
        }
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={item}
                            onChange={(e) => handleItemChange(index, e.target.value)}
                            className="block w-full p-2 border-gray-300 rounded-md shadow-sm text-sm"
                            placeholder={placeholder}
                        />
                        <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={addItem}
                className="mt-3 flex items-center text-sm font-medium text-recife-ocean hover:text-blue-800"
            >
                <PlusIcon className="h-4 w-4 mr-1" />
                Adicionar Item
            </button>
        </div>
    );
};


const ArtistaEditor: React.FC<ArtistaEditorProps> = ({ artistaId, onSave, onCancel }) => {
    const { wordPressCredentials } = useAppContext();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<WordPressPost['status']>('draft');
    
    // Meta Fields State
    const [tipoDeArtista, setTipoDeArtista] = useState('Solo');
    const [anoFormacao, setAnoFormacao] = useState('');
    const [cidadeOrigem, setCidadeOrigem] = useState('');
    const [website, setWebsite] = useState('');
    const [email, setEmail] = useState('');
    const [telefones, setTelefones] = useState<string[]>(['']);
    const [redesSociais, setRedesSociais] = useState<string[]>(['']);
    const [videos, setVideos] = useState<string[]>(['']);

    const { editorRef, initializeQuill, setContent: setQuillContent } = useQuillEditor('Adicione uma biografia ou descrição do artista...');

    const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const { showToast } = useToast();
    const isEditing = artistaId !== undefined;

    useEffect(() => {
        initializeQuill(setContent);
    }, [initializeQuill]);

    useEffect(() => {
        const fetchArtistaData = async () => {
            if (!isEditing || !wordPressCredentials.siteUrl) return;
            setIsLoading(true);
            try {
                const artista = await getCPTItemById(wordPressCredentials, 'artista', artistaId);
                setTitle(artista.title.rendered);
                const postContent = artista.content?.raw || '';
                setContent(postContent);
                setQuillContent(postContent);
                
                setStatus(artista.status);
                
                // Populate meta fields
                const meta = artista.meta || {};
                setTipoDeArtista(meta.tipo_de_artista || 'Solo');
                setAnoFormacao(meta.artista_ano_formacao || '');
                setCidadeOrigem(meta.artista_origem || '');
                setWebsite(meta.website || '');
                setEmail(meta['e-mail'] || '');

                // For repeaters, ensure it's an array and has at least one item for the UI
                setTelefones(Array.isArray(meta.telefone) && meta.telefone.length > 0 ? meta.telefone : ['']);
                setRedesSociais(Array.isArray(meta.redes_sociais) && meta.redes_sociais.length > 0 ? meta.redes_sociais : ['']);
                setVideos(Array.isArray(meta.videos_artistas) && meta.videos_artistas.length > 0 ? meta.videos_artistas : ['']);

                const featuredMedia = artista._embedded?.['wp:featuredmedia']?.[0];
                if (featuredMedia?.source_url) {
                    setFeaturedImageUrl(featuredMedia.source_url);
                }
            } catch (e: any) {
                showToast(e.message || 'Falha ao carregar dados do artista.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchArtistaData();
    }, [artistaId, isEditing, wordPressCredentials, showToast, initializeQuill, setQuillContent]);

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
                    tipo_de_artista: tipoDeArtista,
                    artista_ano_formacao: anoFormacao,
                    artista_origem: cidadeOrigem,
                    website: website,
                    'e-mail': email,
                    // Filter out empty strings before saving
                    telefone: telefones.filter(t => t && t.trim() !== ''),
                    redes_sociais: redesSociais.filter(r => r && r.trim() !== ''),
                    videos_artistas: videos.filter(v => v && v.trim() !== ''),
                }
            };
            if (featuredMediaId) {
                itemData.featured_media = featuredMediaId;
            }

            if (isEditing) {
                await updateCPTItem(wordPressCredentials, 'artista', artistaId, itemData);
                showToast('Artista atualizado com sucesso!', 'success');
            } else {
                await createCPTItem(wordPressCredentials, 'artista', itemData);
                showToast('Artista criado com sucesso!', 'success');
            }
            onSave();
        } catch (e: any) {
            showToast(e.message || 'Ocorreu um erro ao salvar o artista.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-10 text-center">Carregando editor...</div>;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
            {imageToCrop && <ImageCropperModal imageSrc={imageToCrop} onClose={() => setImageToCrop(null)} onCropComplete={handleCropComplete} />}
            <form onSubmit={handleSave}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Editar Artista' : 'Criar Novo Artista'}</h1>
                    <div className="flex items-center space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-recife-red hover:bg-red-700 disabled:bg-gray-400">
                            {isSaving ? <><LoadingSpinner /> Salvando...</> : 'Salvar Artista'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Nome do Artista</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm sm:text-lg text-gray-900" required />
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Biografia / Descrição</label>
                            <div ref={editorRef} style={{ minHeight: '300px' }}></div>
                        </div>

                        {/* Detalhes Artísticos Section */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-3">Detalhes Artísticos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div>
                                    <label htmlFor="tipoDeArtista" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Artista</label>
                                    <select id="tipoDeArtista" value={tipoDeArtista} onChange={e => setTipoDeArtista(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm">
                                        <option>Solo</option>
                                        <option>Banda</option>
                                        <option>Coletivo</option>
                                        <option>Dupla</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="anoFormacao" className="block text-sm font-medium text-gray-700 mb-1">Ano de Formação</label>
                                    <input type="text" id="anoFormacao" value={anoFormacao} onChange={e => setAnoFormacao(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="cidadeOrigem" className="block text-sm font-medium text-gray-700 mb-1">Cidade de Origem</label>
                                    <input type="text" id="cidadeOrigem" value={cidadeOrigem} onChange={e => setCidadeOrigem(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Galeria</label>
                                    <button type="button" className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                                        Gerenciar Mídia
                                    </button>
                                </div>
                                <div className="md:col-span-2">
                                    <RepeaterField label="Vídeos" items={videos} setItems={setVideos} placeholder="https://youtube.com/..." />
                                </div>
                            </div>
                        </div>

                         {/* Contato Section */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-3">Contato</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                                    <input type="url" id="website" value={website} onChange={e => setWebsite(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm" placeholder="https://..."/>
                                </div>
                                <div className="md:col-span-2">
                                    <RepeaterField label="Telefone" items={telefones} setItems={setTelefones} placeholder="(81) 9..." />
                                </div>
                                 <div className="md:col-span-2">
                                    <RepeaterField label="Redes Sociais" items={redesSociais} setItems={setRedesSociais} placeholder="https://instagram.com/..." />
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Publicação</h3>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select id="status" value={status} onChange={e => setStatus(e.target.value as WordPressPost['status'])} className="block w-full p-2 border-gray-300 rounded-md shadow-sm">
                                <option value="draft">Rascunho</option>
                                <option value="publish">Publicado</option>
                            </select>
                        </div>
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Imagem de Destaque</h3>
                            <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                {featuredImageUrl ? (
                                    <img src={featuredImageUrl} alt="Featured" className="w-full h-full object-cover rounded-md" />
                                ) : (
                                    <div className="text-gray-500 text-center"><ImageIcon className="mx-auto h-10 w-10" /><p className="mt-2 text-sm">Nenhuma imagem</p></div>
                                )}
                            </div>
                            <label htmlFor="image-upload" className="mt-4 w-full cursor-pointer flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                                <CameraIcon className="h-5 w-5 mr-2" />
                                <span>{featuredImageUrl ? 'Trocar Imagem' : 'Enviar Imagem'}</span>
                            </label>
                            <input id="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageSelect} />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ArtistaEditor;
