import React, { useState, useEffect, useCallback } from 'react';
import { WordPressPost } from '../../types';
import { deleteCPTItem, getCPTItems } from '../../services/wordpressService';
import { DocumentTextIcon, PencilIcon, TrashIcon, ImageIcon } from '../ui/icons/Icons';
import { useAppContext } from '../../hooks/useAppContext';
import { useToast } from '../../hooks/useToast';

interface CptListPageProps {
  postType: string;
  postTypeName: string;
  onCreate?: () => void;
  onEdit?: (postId: number) => void;
}

const statusStyles: { [key: string]: string } = {
    publish: 'bg-green-100 text-green-800',
    draft: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-orange-100 text-orange-800',
    private: 'bg-red-100 text-red-800',
    future: 'bg-blue-100 text-blue-800',
};

const Pagination: React.FC<{ currentPage: number, totalPages: number, onPageChange: (page: number) => void }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
    }

    return (
        <nav className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-b-lg">
            <div className="flex-1 flex justify-between sm:hidden">
                 <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Anterior</button>
                 <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">Próximo</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span>
                    </p>
                </div>
                <div>
                    <span className="relative z-0 inline-flex shadow-sm rounded-md">
                        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                            <span className="sr-only">Anterior</span>
                            &lt;
                        </button>
                        {startPage > 1 && (
                            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
                        )}
                        {pageNumbers.map(number => (
                             <button key={number} onClick={() => onPageChange(number)} className={`-ml-px relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${currentPage === number ? 'z-10 bg-brand-red/10 border-brand-red text-brand-red' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                                {number}
                            </button>
                        ))}
                        {endPage < totalPages && (
                             <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>
                        )}
                         <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="-ml-px relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                            <span className="sr-only">Próximo</span>
                            &gt;
                        </button>
                    </span>
                </div>
            </div>
        </nav>
    );
}


const CptListPage: React.FC<CptListPageProps> = ({ postType, postTypeName, onCreate, onEdit }) => {
  const { wordPressCredentials } = useAppContext();
  const { showToast } = useToast();
  const [items, setItems] = useState<WordPressPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);


  const fetchItems = useCallback(async () => {
    if (!wordPressCredentials.siteUrl || !wordPressCredentials.username || !wordPressCredentials.applicationPassword) {
      setError(`Por favor, configure suas credenciais do WordPress na página de Configurações para ver o conteúdo de ${postTypeName}.`);
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { posts, totalPages: fetchedTotalPages } = await getCPTItems(wordPressCredentials, postType, currentPage);
      setItems(posts);
      setTotalPages(fetchedTotalPages);
    } catch (e: any) {
      setError(e.message || `Ocorreu um erro ao buscar os itens de ${postTypeName}.`);
    } finally {
      setIsLoading(false);
    }
  }, [wordPressCredentials, postType, postTypeName, currentPage]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (postId: number) => {
    if (window.confirm('Tem certeza que deseja excluir este item permanentemente?')) {
        try {
            await deleteCPTItem(wordPressCredentials, postType, postId);
            showToast('Item excluído com sucesso!', 'success');
            fetchItems();
        } catch (e: any) {
            setError(e.message || `Ocorreu um erro ao excluir o item ${postId}.`);
            showToast(e.message || `Ocorreu um erro ao excluir o item.`, 'error');
        }
    }
  }
  
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
        setCurrentPage(page);
    }
  }

  const renderContent = () => {
    if (isLoading && items.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-gray-500 py-20">
                <div role="status" className="flex items-center space-x-2">
                    <svg className="animate-spin h-6 w-6 text-brand-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-lg font-medium">Buscando {postTypeName.toLowerCase()}...</span>
                </div>
            </div>
        )
    }

    if (error && items.length === 0) {
        return (
            <div className="text-center py-20 px-6 bg-white rounded-lg border border-red-200 shadow-sm">
                <p className="text-red-600 font-semibold">Erro ao carregar conteúdo</p>
                <p className="text-gray-600 mt-2">{error}</p>
                 <button 
                    onClick={fetchItems}
                    className="mt-4 px-4 py-2 bg-brand-red text-white rounded-md hover:bg-red-700"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-20 px-6 bg-white rounded-lg border border-gray-200 shadow-sm">
                 <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum item encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">Não foi possível encontrar nenhum item recente em {postTypeName}.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagem</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {items.map((item) => {
                            const featuredImage = item._embedded?.['wp:featuredmedia']?.[0];
                            return (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {featuredImage ? (
                                            <img src={featuredImage.source_url} alt={featuredImage.alt_text} className="h-10 w-16 object-cover rounded"/>
                                        ) : (
                                            <div className="h-10 w-16 bg-gray-100 rounded flex items-center justify-center">
                                                <ImageIcon className="h-5 w-5 text-gray-400"/>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap max-w-sm truncate">
                                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-blue-dark hover:text-brand-cyan" title={item.title.rendered}>
                                            {item.title.rendered}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[item.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(item.date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-4">
                                            {onEdit && (
                                              <button onClick={() => onEdit(item.id)} className="text-gray-500 hover:text-brand-purple" title="Editar">
                                                  <PencilIcon className="h-5 w-5" />
                                              </button>
                                            )}
                                            <button onClick={() => handleDelete(item.id)} className="text-gray-500 hover:text-brand-red" title="Excluir">
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
             <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0 mb-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{postTypeName}</h1>
                <p className="mt-2 text-gray-600">
                  Visualize e gerencie os itens de {postTypeName.toLowerCase()} do seu site.
                </p>
            </div>
            {onCreate && (
             <div className="flex items-center space-x-4">
                 <button
                    onClick={() => { setCurrentPage(1); fetchItems(); }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-purple disabled:opacity-50"
                >
                    {isLoading && currentPage === 1 ? 'Atualizando...' : 'Atualizar'}
                </button>
                <button
                    onClick={onCreate}
                    className="px-4 py-2 bg-brand-red border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-red"
                >
                    Criar Novo Item
                </button>
             </div>
            )}
        </div>
        
        {renderContent()}

      </div>
    </div>
  );
};

export default CptListPage;
