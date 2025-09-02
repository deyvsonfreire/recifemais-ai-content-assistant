import React, { useState, useEffect } from 'react';
import { WordPressCredentials, WordPressPost, SeoAnalysis, InitialHistoriaData } from '../types';
import { createCPTItem, getCPTItemById, updateCPTItem, uploadMedia } from '../services/wordpressService';
import { analyzeSeoRealtime } from '../services/seoService';
import LoadingSpinner from './LoadingSpinner';
import SeoAnalyzer from './SeoAnalyzer';
import ImageCropperModal from './ImageCropperModal';
import { CameraIcon, ImageIcon } from './icons/Icons';
import TaxonomySelector from './TaxonomySelector';
import { useToast } from '../hooks/useToast';
import { useQuillEditor } from '../hooks/useQuillEditor';

interface HistoriaEditorProps {
    historiaId?: number;
    initialData?: InitialHistoriaData | null;
    wordPressCredentials: WordPressCredentials;
    onSave: () => void;
    onCancel: () => void;
}

const HistoriaEditor: React.FC<HistoriaEditorProps> = ({ historiaId, initialData, wordPressCredentials, onSave, onCancel }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<WordPressPost['status']>('draft');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [selectedTags, setSelectedTags] = useState<number[]>([]);
    
    const { editorRef, initializeQuill, setContent: setQuillContent } = useQuillEditor('Comece a escrever sua história aqui...');

    const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
    const [imageAltText, setImageAltText] = useState('');
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);

    const [focusKeyword, setFocusKeyword] = useState('');
    const [seoAnalysis, setSeoAnalysis] = useState<SeoAnalysis | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const { showToast } = useToast();
    const isEditing = historiaId !== undefined;

    useEffect(() => {
        initializeQuill(setContent);
    }, [initializeQuill]);
    
    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            const draftContent = initialData.content;
            setContent(draftContent);
            setQuillContent(draftContent);
            setFocusKeyword(initialData.focusKeyword);
            setSelectedCategories(initialData.categoryIds);
            setSelectedTags(initialData.tagIds);
        }
    }, [initialData, setQuillContent]);

    useEffect(() => {
        const fetchHistoriaData = async () => {
            if (!isEditing || !wordPressCredentials.siteUrl) return;
            setIsLoading(true);
            try {
                const historia = await getCPTItemById(wordPressCredentials, 'historia', historiaId);
                setTitle(historia.title.rendered);
                const postContent = historia.content?.raw || '';
                setContent(postContent);
                setQuillContent(postContent);
                setStatus(historia.status);
                setSelectedCategories(historia.categories || []); // Assuming standard categories
                setSelectedTags(historia.tags || []); // Assuming standard tags
                
                const featuredMedia = historia._embedded?.['wp:featuredmedia']?.[0];
                if (featuredMedia) {
                    setFeaturedImageUrl(featuredMedia.source_url);
                    setImageAltText(featuredMedia.alt_text || '');
                }
            } catch (e: any) {
                showToast(e.message || 'Falha ao carregar a história.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistoriaData();
    }, [historiaId, isEditing, wordPressCredentials, showToast, setQuillContent]);

    useEffect(() => {
        const analysisResult = analyzeSeoRealtime({
            title, content, focusKeyword, urlSlug: '', imageAltText,
            hasFeaturedImage: !!featuredImageUrl || !!croppedImageFile,
        });
        setSeoAnalysis(analysisResult);
    }, [title, content, focusKeyword, imageAltText, featuredImageUrl, croppedImageFile]);


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
            
            const postData: any = { 
                title, content, status,
                categories: selectedCategories,
                tags: selectedTags,
            };
            if (featuredMediaId) postData.featured_media = featuredMediaId;

            if (isEditing) {
                await updateCPTItem(wordPressCredentials, 'historia', historiaId, postData);
                showToast('História atualizada com sucesso!', 'success');
            } else {
                await createCPTItem(wordPressCredentials, 'historia', postData);
                showToast('História criada com sucesso!', 'success');
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
                    <h1 className="text-3xl font-bold text-gray-900">{isEditing ? 'Editar História' : 'Criar Nova História'}</h1>
                    <div className="flex items-center space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium bg-white border rounded-md">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-recife-red rounded-md disabled:bg-gray-400">
                            {isSaving ? <><LoadingSpinner /> Salvando...</> : 'Salvar História'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md sm:text-lg" required />
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                            <div ref={editorRef} style={{ minHeight: '400px' }}></div>
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
                        <TaxonomySelector title="Categorias" taxonomyRestBase="categories" wordPressCredentials={wordPressCredentials} selectedTerms={selectedCategories} onChange={setSelectedCategories}/>
                        <TaxonomySelector title="Tags" taxonomyRestBase="tags" wordPressCredentials={wordPressCredentials} selectedTerms={selectedTags} onChange={setSelectedTags}/>
                        <div className="bg-white p-5 rounded-lg shadow-sm border">
                            <h3 className="text-lg font-medium mb-2">Imagem Destacada</h3>
                            <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                                {featuredImageUrl ? <img src={featuredImageUrl} alt="Featured" className="w-full h-full object-cover rounded-md" /> : <div className="text-gray-500"><ImageIcon className="mx-auto h-10 w-10" /></div>}
                            </div>
                             <label htmlFor="image-upload" className="mt-4 w-full cursor-pointer flex justify-center items-center px-4 py-2 border rounded-md bg-white">
                               <CameraIcon className="h-5 w-5 mr-2" /><span>{featuredImageUrl ? 'Trocar' : 'Enviar'} Imagem</span>
                            </label>
                            <input id="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageSelect}/>
                            <div className="mt-4">
                                <label htmlFor="imageAltText" className="block text-sm font-medium text-gray-700 mb-1">Texto Alternativo (Alt)</label>
                                <input type="text" id="imageAltText" value={imageAltText} onChange={e => setImageAltText(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md" />
                            </div>
                        </div>
                        <SeoAnalyzer focusKeyword={focusKeyword} onFocusKeywordChange={setFocusKeyword} analysis={seoAnalysis}/>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default HistoriaEditor;