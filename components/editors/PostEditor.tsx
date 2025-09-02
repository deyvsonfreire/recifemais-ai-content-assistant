import React, { useState, useEffect, useCallback } from 'react';
import { WordPressPost, SeoAnalysis, InitialPostData } from '../../types';
import { createCPTItem, getCPTItemById, updateCPTItem, uploadMedia } from '../../services/wordpressService';
import { analyzeSeoRealtime } from '../../services/seoService';
import LoadingSpinner from '../ui/LoadingSpinner';
import SeoAnalyzer from '../ui/SeoAnalyzer';
import ImageCropperModal from '../ui/ImageCropperModal';
import { CameraIcon, ImageIcon } from '../ui/icons/Icons';
import TaxonomySelector from '../ui/TaxonomySelector';
import { useToast } from '../../hooks/useToast';
import { useQuillEditor } from '../../hooks/useQuillEditor';
import { useAppContext } from '../../hooks/useAppContext';

interface PostEditorProps {
    postId?: number;
    initialData?: InitialPostData | null;
    onSave: () => void;
    onCancel: () => void;
}

const PostEditor: React.FC<PostEditorProps> = ({ postId, initialData, onSave, onCancel }) => {
    const { wordPressCredentials } = useAppContext();
    const [title, setTitle] = useState('');
    const [urlSlug, setUrlSlug] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<WordPressPost['status']>('draft');
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
    const [selectedTags, setSelectedTags] = useState<number[]>([]);
    
    // Use the custom hook for Quill editor management
    const { editorRef, initializeQuill, setContent: setQuillContent } = useQuillEditor('Comece a escrever sua notícia aqui...');

    const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
    const [imageAltText, setImageAltText] = useState('');
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [croppedImageFile, setCroppedImageFile] = useState<File | null>(null);

    const [focusKeyword, setFocusKeyword] = useState('');
    const [seoAnalysis, setSeoAnalysis] = useState<SeoAnalysis | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const { showToast } = useToast();
    const isEditing = postId !== undefined;

    // Initialize Quill editor
    useEffect(() => {
        initializeQuill(setContent);
    }, [initializeQuill]);
    
    // Populate form from AI Draft
    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            const draftContent = initialData.content;
            setContent(draftContent);
            setQuillContent(draftContent); // Safely set content in Quill
            setFocusKeyword(initialData.focusKeyword);
            setSelectedCategories(initialData.categoryIds);
            setSelectedTags(initialData.tagIds);
        }
    }, [initialData, setQuillContent]);

    // Fetch existing post data
    const fetchPostData = useCallback(async () => {
        if (!isEditing || !wordPressCredentials.siteUrl) return;
        setIsLoading(true);
        try {
            const post = await getCPTItemById(wordPressCredentials, 'posts', postId);
            setTitle(post.title.rendered);
            const postContent = post.content?.raw || '';
            setContent(postContent);
            setQuillContent(postContent); // Safely set content in Quill
            setStatus(post.status);
            setSelectedCategories(post.categories || []);
            setSelectedTags(post.tags || []);
            
            const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
            if (featuredMedia?.source_url) {
                setFeaturedImageUrl(featuredMedia.source_url);
                setImageAltText(featuredMedia.alt_text || '');
            }
        } catch (e: any) {
            showToast(e.message || 'Falha ao carregar os dados do post.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [postId, isEditing, wordPressCredentials, showToast, setQuillContent]);

    useEffect(() => {
        if (isEditing) {
            fetchPostData();
        }
    }, [fetchPostData, isEditing]);

    // Auto-generate slug from title
    useEffect(() => {
        const generateSlug = (str: string) => str
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9\s-]/g, '') 
            .trim()
            .replace(/\s+/g, '-') 
            .replace(/-+/g, '-');

        if (title && !isEditing) { // Only auto-generate for new posts
            setUrlSlug(generateSlug(title));
        } else if (title && initialData) { // Also generate for AI drafts
             setUrlSlug(generateSlug(title));
        }
    }, [title, isEditing, initialData]);
    
    // Real-time SEO Analysis
    useEffect(() => {
        const analysisResult = analyzeSeoRealtime({
            title,
            content,
            focusKeyword,
            urlSlug,
            imageAltText,
            hasFeaturedImage: !!featuredImageUrl || !!croppedImageFile,
        });
        setSeoAnalysis(analysisResult);
    }, [title, content, focusKeyword, urlSlug, imageAltText, featuredImageUrl, croppedImageFile]);


    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImageToCrop(event.target?.result as string);
            };
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
            // Step 1: Check if there's a new image file to upload.
            if (croppedImageFile) {
                // Step 2: Upload the media file to WordPress.
                const uploadedMedia = await uploadMedia(wordPressCredentials, croppedImageFile);
                // Step 3: Get the ID of the newly uploaded media.
                featuredMediaId = uploadedMedia.id;
            }
            
            const plainTextContent = content.replace(/<[^>]*>/g, ' ');
            const excerpt = plainTextContent.substring(0, 150) + (plainTextContent.length > 150 ? '...' : '');

            const postData: any = { 
                title, 
                content, 
                excerpt, 
                status,
                categories: selectedCategories,
                tags: selectedTags,
            };

            // Step 4: If an image was uploaded, add its ID to the post data.
            if (featuredMediaId) {
                postData.featured_media = featuredMediaId;
            }

            // Step 5: Create or update the post with the complete data.
            if (isEditing) {
                await updateCPTItem(wordPressCredentials, 'posts', postId, postData);
                showToast('Post atualizado com sucesso!', 'success');
            } else {
                await createCPTItem(wordPressCredentials, 'posts', postData);
                showToast('Post criado com sucesso!', 'success');
            }
            onSave();
        } catch (e: any) {
            showToast(e.message || 'Ocorreu um erro ao salvar o post.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-10 flex items-center justify-center h-full">
                <div role="status" className="flex items-center space-x-2 text-gray-500">
                    <svg className="animate-spin h-6 w-6 text-brand-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                            {isEditing ? 'Editar Post' : 'Criar Novo Post'}
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Preencha os detalhes abaixo para {isEditing ? 'atualizar' : 'criar'} seu post.
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-red hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red disabled:bg-gray-400 disabled:cursor-wait"
                        >
                            {isSaving ? <><LoadingSpinner /> Salvando...</> : (isEditing ? 'Atualizar Post' : 'Salvar Post')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-lg" required />
                        </div>
                         <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                             <label htmlFor="urlSlug" className="block text-sm font-medium text-gray-700 mb-1">URL (Slug)</label>
                             <div className="flex items-center">
                                 <span className="text-sm text-gray-500 bg-gray-100 p-2 border border-r-0 border-gray-300 rounded-l-md">.../</span>
                                 <input type="text" id="urlSlug" value={urlSlug} onChange={e => setUrlSlug(e.target.value)} className="block w-full p-2 border-gray-300 rounded-r-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm" />
                             </div>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                            <div ref={editorRef}></div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                             <h3 className="text-lg font-medium text-gray-900 mb-4">Publicação</h3>
                             <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                             <select id="status" value={status} onChange={e => setStatus(e.target.value as WordPressPost['status'])} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm">
                                <option value="draft">Rascunho</option>
                                <option value="publish">Publicado</option>
                                <option value="pending">Revisão Pendente</option>
                                <option value="private">Privado</option>
                            </select>
                        </div>
                        <TaxonomySelector
                            title="Categorias"
                            taxonomyRestBase="categories"
                            selectedTerms={selectedCategories}
                            onChange={setSelectedCategories}
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
                                        <p className="mt-2 text-sm">Nenhuma imagem selecionada</p>
                                    </div>
                                )}
                            </div>
                             <label htmlFor="image-upload" className="mt-4 w-full cursor-pointer flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                               <CameraIcon className="h-5 w-5 mr-2" />
                               <span>{featuredImageUrl ? 'Trocar Imagem' : 'Enviar Imagem'}</span>
                            </label>
                            <input id="image-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleImageSelect}/>
                            <div className="mt-4">
                                <label htmlFor="imageAltText" className="block text-sm font-medium text-gray-700 mb-1">Texto Alternativo (Alt Text)</label>
                                <input type="text" id="imageAltText" value={imageAltText} onChange={e => setImageAltText(e.target.value)} className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm" placeholder="Descreva a imagem..." />
                            </div>
                        </div>
                        <SeoAnalyzer
                            focusKeyword={focusKeyword}
                            onFocusKeywordChange={setFocusKeyword}
                            analysis={seoAnalysis}
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default PostEditor;
