import React, { useState, useEffect } from 'react';
import { WordPressTerm } from '../../types';
import { getTerms } from '../../services/wordpressService';
import { useAppContext } from '../../hooks/useAppContext';

interface TaxonomySelectorProps {
  title: string;
  taxonomyRestBase: string;
  selectedTerms: number[];
  onChange: (selectedIds: number[]) => void;
}

const TaxonomySelector: React.FC<TaxonomySelectorProps> = ({
  title,
  taxonomyRestBase,
  selectedTerms,
  onChange,
}) => {
  const { wordPressCredentials } = useAppContext();
  const [terms, setTerms] = useState<WordPressTerm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTerms = async () => {
      if (!wordPressCredentials.siteUrl || !wordPressCredentials.username || !wordPressCredentials.applicationPassword) {
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const fetchedTerms = await getTerms(wordPressCredentials, taxonomyRestBase);
        setTerms(fetchedTerms);
      } catch (e: any) {
        setError(`Falha ao carregar ${title}.`);
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTerms();
  }, [wordPressCredentials, taxonomyRestBase, title]);

  const handleCheckboxChange = (termId: number) => {
    const newSelected = selectedTerms.includes(termId)
      ? selectedTerms.filter(id => id !== termId)
      : [...selectedTerms, termId];
    onChange(newSelected);
  };

  const renderContent = () => {
    if (isLoading) return <p className="text-sm text-gray-500 p-2">Carregando...</p>;
    if (error) return <p className="text-sm text-red-500 p-2">{error}</p>;
    if (terms.length === 0) return <p className="text-sm text-gray-500 p-2">Nenhum item encontrado.</p>;

    return (
      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 border border-gray-200 rounded-md p-3 bg-gray-50">
        {terms.map(term => (
          <div key={term.id} className="flex items-center">
            <input
              id={`term-${term.id}`}
              type="checkbox"
              checked={selectedTerms.includes(term.id)}
              onChange={() => handleCheckboxChange(term.id)}
              className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
            />
            <label htmlFor={`term-${term.id}`} className="ml-3 block text-sm text-gray-700 select-none cursor-pointer">
              {term.name}
            </label>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      {renderContent()}
    </div>
  );
};

export default TaxonomySelector;
