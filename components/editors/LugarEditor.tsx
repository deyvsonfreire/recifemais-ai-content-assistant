import React, { useState, useEffect } from 'react';
import { WordPressPost } from '../../types';
import { createCPTItem, getCPTItemById, updateCPTItem, uploadMedia } from '../../services/wordpressService';
import { searchPlaceInformation } from '../../services/geminiService';
import LoadingSpinner from '../ui/LoadingSpinner';
import ImageCropperModal from '../ui/ImageCropperModal';
import { CameraIcon, ImageIcon, PlusIcon, TrashIcon, MagicWandIcon } from '../ui/icons/Icons';
import TaxonomySelector from '../ui/TaxonomySelector';
import { useToast } from '../../hooks/useToast';
import { useQuillEditor } from '../../hooks/useQuillEditor';
import { useAppContext } from '../../hooks/useAppContext';

interface LugarEditorProps {
    lugarId?: number;
    onSave: () => void;
    onCancel: () => void;
}

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
        // Prevent removing the last item, just clear it
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        } else {
            setItems(['']);
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


const LugarEditor: React.FC<LugarEditorProps> = ({ lugarId, onSave, onCancel }) => {
    const { wordPressCredentials } = useAppContext();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<WordPressPost['status']>('draft');
    
    // Meta Fields
    const [endereco, setEndereco] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [estado, setEstado] = useState('');
    const [cep, setCep] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [telefones, setTelefones] = useState<string[]>(['']);
    const [email, setEmail] = useState('');
    const [redesSociais, setRedesSociais] = useState<string[]>(['']);
    const [website, setWebsite] = useState('');
    const [horarioFuncionamento, setHorarioFuncionamento] = useState('');
    const [detalhesAdicionais, setDetalhesAdicionais] = useState('');

    // Taxonomies
    const [selectedCidades, setSelectedCidades] = useState<number[]>([]);
    const [selectedTipos, setSelectedTipos] = useState<number[]>([]);
    const [selectedTags, setSelectedTags] = useState<number[]>([]);
    
    const { editorRef: descEditorRef, initializeQuill: initializeDescQuill, setContent: setDescQuillContent } = useQuillEditor('Adicione uma descrição detalhada sobre o lugar...');
    const { editorRef: detailsEditorRef, initializeQuill: initializeDetailsQuill, setContent: setDetailsQuillContent } = useQuillEditor('Detalhes adicionais, como regras da casa, etc.');


    const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSearchingWithAI, setIsSearchingWithAI] = useState(false);

    
    const { showToast } = useToast();
    const isEditing = lugarId !== undefined;

    useEffect(() => {
        initializeDescQuill(setContent);
        initializeDetailsQuill(setDetalhesAdicionais);
    }, [initializeDescQuill, initializeDetailsQuill]);

    useEffect(() => {
        const fetchLugarData = async () => {
            if (!isEditing || !wordPressCredentials.siteUrl) return;
            setIsLoading(true);
            try {
                const lugar = await getCPTItemById(wordPressCredentials, 'lugar', lugarId);
                setTitle(lugar.title.rendered);
                const descContent = lugar.content?.raw || '';
                setContent(descContent);
                setDescQuillContent(descContent);
                
                setStatus(lugar.status);
                
                // Populate meta fields
                const meta = lugar.meta || {};
                setEndereco(meta.endereco || '');
                setBairro(meta.bairro || '');
                setCidade(meta.cidade || '');
                setEstado(meta.estado || '');
                setCep(meta.cep || '');
                setLatitude(meta.latitude || '');
                setLongitude(meta.longitude || '');
                setEmail(meta['e-mail'] || '');
                setWebsite(meta.website || '');
                setHorarioFuncionamento(meta.horario_de_funcionamento || '');
                const detailsContent = meta.detalhes_adicionais || '';
                setDetalhesAdicionais(detailsContent);
                setDetailsQuillContent(detailsContent);
                
                // Handle repeaters
                setTelefones(Array.isArray(meta.telefone) && meta.telefone.length > 0 ? meta.telefone : ['']);
                setRedesSociais(Array.isArray(meta.redes_sociais) && meta.redes_sociais.length > 0 ? meta.redes_sociais : ['']);

                // Populate custom taxonomies & tags
                // @ts-ignore
                setSelectedCidades(lugar.categorias_lugares || []);
                // @ts-ignore
                setSelectedTipos(lugar.tipos_lugares || []);
                setSelectedTags(lugar.tags || []);
                
                const featuredMedia = lugar._embedded?.['wp:featuredmedia']?.[0];
                if (featuredMedia?.source_url) {
                    setFeaturedImageUrl(featuredMedia.source_url);
                }
            } catch (e: any) {
                showToast(e.message || 'Falha ao carregar os dados do lugar.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        if (isEditing) {
            fetchLugarData();
        }
    }, [lugarId, isEditing, wordPressCredentials, showToast, setDescQuillContent, setDetailsQuillContent]);

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
                setCep(draft.zipcode || '');
                setTelefones(draft.phone ? [draft.phone] : ['']);
                setWebsite(draft.website || '');
                
                if (draft.description) {
                   setDescQuillContent(draft.description);
                }
                showToast('Informações do local importadas!', 'success');
            } else {
                showToast('Nenhuma informação encontrada para este local.', 'info');
            }
        } catch (e: any) {
            showToast(`Erro ao buscar informações: ${e.message}`, 'error');
        } finally {
            setIsSearchingWithAI(false);
        }
    };

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
            let featuredMediaId: number | undefined = undefined;
            if (croppedImageFile) {
                const uploadedMedia = await uploadMedia(wordPressCredentials, croppedImageFile);
                featuredMediaId = uploadedMedia.id;
            }
            
            const itemData: any = { 
                title, 
                content, 
                status,
                tags: selectedTags,
                'categorias_lugares': selectedCidades,
                'tipos_lugares': selectedTipos,
                meta: {
                    endereco,
                    bairro,
                    cidade,
                    estado,
                    cep,
                    latitude,
                    longitude,
                    'e-mail': email,
                    website,
                    horario_de_funcionamento: horarioFuncionamento,
                    detalhes_adicionais: detalhesAdicionais,
                    telefone: telefones.filter(t => t && t.trim() !== ''),
                    redes_sociais: redesSociais.filter(r => r && r.trim() !== ''),
                },
            };

            if (featuredMediaId) {
                itemData.featured_media = featuredMediaId;
            }

            if (isEditing) {
                await updateCPTItem(wordPressCredentials, 'lugar', lugarId, itemData);
                showToast('Lugar atualizado com sucesso!', 'success');
            } else {
                await createCPTItem(wordPressCredentials, 'lugar', itemData);
                showToast('Lugar criado com sucesso!', 'success');
            }
            onSave();
        } catch (e: any) {
            showToast(e.message || 'Ocorreu um erro ao salvar o lugar.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-10 flex items-center justify-center h-full">
                <div role="status" className="flex items-center space-x-2 text-gray-500">
                    <svg className="animate-spin h-6 w-6 text-recife-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-lg font-medium">Carregando editor...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
             {imageToCrop && (
                <ImageCropperModal
                    imageSrc={imageToCrop}
                    onClose={() => setImageToCrop(null)}
                    onCropComplete={handleCropComplete}
                />
            )}
            <form onSubmit={handleSave}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEditing ? 'Editar Lugar' : 'Criar Novo Lugar'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Preencha os detalhes do local.
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-recife-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-recife-red disabled:bg-gray-400 disabled:cursor-wait"
                        >
                            {isSaving ? <><LoadingSpinner /> Salvando...</> : (isEditing ? 'Atualizar Lugar' : 'Salvar Lugar')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Nome do Lugar</label>
                            <div className="flex flex-wrap items-center gap-2">
                                <input 
                                    type="text" id="title" value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    className="flex-grow block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-recife-red focus:border-recife-red sm:text-lg text-gray-900" 
                                    required 
                                />
                                <button
                                    type="button"
                                    onClick={handleSearchPlace}
                                    disabled={isSearchingWithAI || !title.trim()}
                                    className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-recife-creative hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-recife-creative disabled:bg-gray-400"
                                >
                                    {isSearchingWithAI ? (
                                        <><LoadingSpinner /> Buscando...</>
                                    ) : (
                                        <>
                                            <MagicWandIcon className="h-5 w-5 mr-2" />
                                            Buscar com IA
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                         <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Principal</label>
                            <div ref={descEditorRef} style={{ minHeight: '250px' }}></div>
                        </div>

                         <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-3">Endereço</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="md:col-span-2">
                                    <label htmlFor="endereco" className="block text-sm font-medium text-gray-700 mb-1">Endereço <span className="text-red-500">*</span></label>
                                    <input type="text" id="endereco" value={endereco} onChange={e => setEndereco(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" required/>
                                </div>
                                <div>
                                    <label htmlFor="bairro" className="block text-sm font-medium text-gray-700 mb-1">Bairro <span className="text-red-500">*</span></label>
                                    <input type="text" id="bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" required/>
                                </div>
                                 <div>
                                    <label htmlFor="cidade" className="block text-sm font-medium text-gray-700 mb-1">Cidade <span className="text-red-500">*</span></label>
                                    <input type="text" id="cidade" value={cidade} onChange={e => setCidade(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" required/>
                                </div>
                                 <div>
                                    <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">Estado <span className="text-red-500">*</span></label>
                                    <input type="text" id="estado" value={estado} onChange={e => setEstado(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" required/>
                                </div>
                                  <div>
                                    <label htmlFor="cep" className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                    <input type="text" id="cep" value={cep} onChange={e => setCep(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md"/>
                                </div>
                                 <div>
                                    <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                                    <input type="text" id="latitude" value={latitude} onChange={e => setLatitude(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md"/>
                                </div>
                                 <div>
                                    <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                                    <input type="text" id="longitude" value={longitude} onChange={e => setLongitude(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md"/>
                                </div>
                            </div>
                        </div>

                         <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-3">Contato</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" />
                                </div>
                                 <div>
                                    <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                                    <input type="url" id="website" value={website} onChange={e => setWebsite(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" placeholder="https://..." />
                                </div>
                                <div className="md:col-span-2">
                                     <RepeaterField label="Telefone" items={telefones} setItems={setTelefones} placeholder="(81) 9..." />
                                </div>
                                <div className="md:col-span-2">
                                    <RepeaterField label="Redes Sociais" items={redesSociais} setItems={setRedesSociais} placeholder="https://instagram.com/..." />
                                </div>
                            </div>
                        </div>
                        
                         <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-3">Detalhes do Lugar</h3>
                             <div className="grid grid-cols-1 gap-6 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Galeria de Fotos</label>
                                    <button type="button" className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                                        Gerenciar Mídia
                                    </button>
                                </div>
                                 <div>
                                    <label htmlFor="horarioFuncionamento" className="block text-sm font-medium text-gray-700 mb-1">Horário de Funcionamento</label>
                                    <textarea id="horarioFuncionamento" rows={4} value={horarioFuncionamento} onChange={e => setHorarioFuncionamento(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md"></textarea>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Detalhes Adicionais</label>
                                    <div ref={detailsEditorRef} style={{ minHeight: '200px' }}></div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                             <h3 className="text-lg font-medium text-gray-900 mb-4">Publicação</h3>
                             <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                             <select id="status" value={status} onChange={e => setStatus(e.target.value as WordPressPost['status'])} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-recife-red focus:border-recife-red sm:text-sm">
                                <option value="draft">Rascunho</option>
                                <option value="publish">Publicado</option>
                                <option value="pending">Revisão Pendente</option>
                                <option value="private">Privado</option>
                            </select>
                        </div>
                        <TaxonomySelector
                            title="Cidades"
                            taxonomyRestBase="categorias_lugares"
                            selectedTerms={selectedCidades}
                            onChange={setSelectedCidades}
                        />
                         <TaxonomySelector
                            title="Tipos de Lugares"
                            taxonomyRestBase="tipos_lugares"
                            selectedTerms={selectedTipos}
                            onChange={setSelectedTipos}
                        />
                        <TaxonomySelector
                            title="Tags"
                            taxonomyRestBase="tags"
                            selectedTerms={selectedTags}
                            onChange={setSelectedTags}
                        />
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Imagem Destacada</h3>
                            <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-center">
                                {featuredImageUrl ? (
                                    <img src={featuredImageUrl} alt="Featured" className="w-full h-full object-cover rounded-md" />
                                ) : (
                                    <div className="text-gray-500">
                                        <ImageIcon className="mx-auto h-10 w-10" />
                                        <p className="mt-2 text-sm">Nenhuma imagem</p>
                                    </div>
                                )}
                            </div>
                             <label htmlFor="image-upload" className="mt-4 w-full cursor-pointer flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                               <CameraIcon className="h-5 w-5 mr-2" />
                               <span>{featuredImageUrl ? 'Trocar' : 'Enviar Imagem'}</span>
                            </label>
                            <input id="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleImageSelect}/>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default LugarEditor;
