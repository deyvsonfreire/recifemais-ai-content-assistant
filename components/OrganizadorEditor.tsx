import React, { useState, useEffect } from 'react';
import { WordPressCredentials, WordPressPost, InitialOrganizadorData } from '../types';
import { createCPTItem, getCPTItemById, updateCPTItem, uploadMedia } from '../services/wordpressService';
import LoadingSpinner from './LoadingSpinner';
import ImageCropperModal from './ImageCropperModal';
import { CameraIcon, ImageIcon } from './icons/Icons';
import { useToast } from '../hooks/useToast';
import { useQuillEditor } from '../hooks/useQuillEditor';

interface OrganizadorEditorProps {
    organizadorId?: number;
    initialData?: InitialOrganizadorData | null;
    wordPressCredentials: WordPressCredentials;
    onSave: () => void;
    onCancel: () => void;
}

const OrganizadorEditor: React.FC<OrganizadorEditorProps> = ({ organizadorId, initialData, wordPressCredentials, onSave, onCancel }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<WordPressPost['status']>('draft');
    
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [website, setWebsite] = useState('');
    const [instagram, setInstagram] = useState('');
    
    const { editorRef, initializeQuill, setContent: setQuillContent } = useQuillEditor('Descreva a organização...');

    const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const { showToast } = useToast();
    const isEditing = organizadorId !== undefined;

    useEffect(() => {
        initializeQuill(setContent);
    }, [initializeQuill]);

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            const initialContent = initialData.content || '';
            setContent(initialContent);
            // Add a small delay to ensure Quill is fully initialized before setting content
            setTimeout(() => {
                setQuillContent(initialContent);
            }, 100);
            setAddress(initialData.address || '');
            setPhone(initialData.phone || '');
            setWebsite(initialData.website || '');
            setInstagram(initialData.instagram || '');
        }
    }, [initialData, setQuillContent]);

    useEffect(() => {
        const fetchOrganizadorData = async () => {
            if (!isEditing || !wordPressCredentials.siteUrl) return;
            setIsLoading(true);
            try {
                const organizador = await getCPTItemById(wordPressCredentials, 'organizador', organizadorId);
                setTitle(organizador.title.rendered);
                const postContent = organizador.content?.raw || '';
                setContent(postContent);
                // Add a small delay to ensure Quill is fully initialized before setting content
                setTimeout(() => {
                    setQuillContent(postContent);
                }, 100);
                setStatus(organizador.status);
                
                setAddress(organizador.meta?.endereco || '');
                setPhone(organizador.meta?.telefone || '');
                setWebsite(organizador.meta?.website || '');
                setInstagram(organizador.meta?.instagram || '');
                
                const featuredMedia = organizador._embedded?.['wp:featuredmedia']?.[0];
                if (featuredMedia) setFeaturedImageUrl(featuredMedia.source_url);
            } catch (e: any) {
                showToast(e.message || 'Falha ao carregar o organizador.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrganizadorData();
    }, [organizadorId, isEditing, wordPressCredentials, showToast, setQuillContent]);


    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
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
                title, content, status,
                meta: {
                    endereco: address,
                    telefone: phone,
                    website: website,
                    instagram: instagram,
                },
            };
            if (featuredMediaId) itemData.featured_media = featuredMediaId;

            if (isEditing) {
                await updateCPTItem(wordPressCredentials, 'organizador', organizadorId, itemData);
                showToast('Organizador atualizado com sucesso!', 'success');
            } else {
                await createCPTItem(wordPressCredentials, 'organizador', itemData);
                showToast('Organizador criado com sucesso!', 'success');
            }
            onSave();
        } catch (e: any) {
            showToast(e.message || 'Ocorreu um erro ao salvar.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Carregando editor...</div>;

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
             {imageToCrop && <ImageCropperModal imageSrc={imageToCrop} onClose={() => setImageToCrop(null)} onCropComplete={handleCropComplete}/>}
            <form onSubmit={handleSave}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-6">
                     <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Editar Organizador' : 'Criar Novo Organizador'}</h1>
                    <div className="flex items-center space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm bg-white border rounded-md">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex items-center px-4 py-2 text-sm text-white bg-recife-red rounded-md disabled:bg-gray-400">
                            {isSaving ? <><LoadingSpinner /> Salvando...</> : 'Salvar Organizador'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <label htmlFor="title" className="block text-sm font-medium mb-1">Nome do Organizador</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md sm:text-lg" required />
                        </div>
                         <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <label className="block text-sm font-medium mb-1">Descrição</label>
                            <div ref={editorRef} style={{ minHeight: '250px' }}></div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label htmlFor="address" className="block text-sm font-medium mb-1">Endereço</label>
                                <input type="text" id="address" value={address} onChange={e => setAddress(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium mb-1">Telefone</label>
                                <input type="text" id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" />
                            </div>
                            <div>
                                <label htmlFor="website" className="block text-sm font-medium mb-1">Website</label>
                                <input type="url" id="website" value={website} onChange={e => setWebsite(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" placeholder="https://..." />
                            </div>
                             <div>
                                <label htmlFor="instagram" className="block text-sm font-medium mb-1">Instagram</label>
                                <input type="text" id="instagram" value={instagram} onChange={e => setInstagram(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" placeholder="@perfil" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border">
                             <h3 className="text-lg font-medium mb-4">Publicação</h3>
                             <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
                             <select id="status" value={status} onChange={e => setStatus(e.target.value as WordPressPost['status'])} className="block w-full p-2 border-gray-300 rounded-md">
                                <option value="draft">Rascunho</option>
                                <option value="publish">Publicado</option>
                            </select>
                        </div>
                        <div className="bg-white p-5 rounded-lg shadow-sm border">
                            <h3 className="text-lg font-medium mb-2">Imagem / Logo</h3>
                            <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                                {featuredImageUrl ? <img src={featuredImageUrl} alt="Featured" className="w-full h-full object-cover rounded-md" /> : <div className="text-gray-500"><ImageIcon className="mx-auto h-10 w-10" /></div>}
                            </div>
                             <label htmlFor="image-upload" className="mt-4 w-full cursor-pointer flex justify-center items-center px-4 py-2 border rounded-md bg-white">
                               <CameraIcon className="h-5 w-5 mr-2" /><span>{featuredImageUrl ? 'Trocar' : 'Enviar'} Imagem</span>
                            </label>
                            <input id="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageSelect}/>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default OrganizadorEditor;