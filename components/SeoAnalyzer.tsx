import React from 'react';
import { SeoAnalysis, SeoCheck } from '../types';
import { CheckCircleIcon, XCircleIcon } from './icons/Icons';

interface SeoAnalyzerProps {
    focusKeyword: string;
    onFocusKeywordChange: (keyword: string) => void;
    analysis: SeoAnalysis | null;
}

const ScoreCircle: React.FC<{ score: number }> = ({ score }) => {
    const getScoreColor = () => {
        if (score >= 80) return 'text-brand-green';
        if (score >= 50) return 'text-brand-yellow-dark';
        return 'text-brand-red';
    };

    const circumference = 2 * Math.PI * 20;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 44 44">
                <circle className="text-gray-200" strokeWidth="4" stroke="currentColor" fill="transparent" r="20" cx="22" cy="22"/>
                <circle
                    className={`${getScoreColor()} transition-all duration-500`}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="20"
                    cx="22"
                    cy="22"
                    transform="rotate(-90 22 22)"
                />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${getScoreColor()}`}>
                {score}
            </span>
        </div>
    );
};

const SeoCheckItem: React.FC<{ check: SeoCheck }> = ({ check }) => {
    const icon = check.status === 'pass' 
        ? <CheckCircleIcon solid className="h-5 w-5 text-brand-green" />
        : <XCircleIcon solid className="h-5 w-5 text-brand-red" />;
  
    return (
      <li className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <p className="text-sm text-gray-600">{check.feedback}</p>
      </li>
    );
};

const categoryTitles: Record<SeoCheck['category'], string> = {
    Basic: 'SEO Básico',
    Additional: 'Adicional',
    Title: 'Legibilidade do Título',
    Content: 'Legibilidade do Conteúdo'
};

const SeoAnalyzer: React.FC<SeoAnalyzerProps> = ({ focusKeyword, onFocusKeywordChange, analysis }) => {

    const renderChecks = (category: SeoCheck['category']) => {
        const checks = analysis?.checks.filter(c => c.category === category) || [];
        if (checks.length === 0) return null;
    
        return (
            <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{categoryTitles[category]}</h4>
                <ul className="mt-3 space-y-2.5">
                    {checks.map((check, index) => (
                        <SeoCheckItem key={`${category}-${index}`} check={check} />
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Análise de SEO</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="focusKeyword" className="block text-sm font-medium text-gray-700 mb-1">Palavra-chave de Foco</label>
                    <input
                        type="text"
                        id="focusKeyword"
                        value={focusKeyword}
                        onChange={e => onFocusKeywordChange(e.target.value)}
                        className="block w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-brand-purple focus:border-brand-purple sm:text-sm"
                        placeholder="Digite a palavra-chave principal"
                    />
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
                {!analysis || !focusKeyword ? (
                     <div className="text-center text-sm text-gray-500 py-4">
                        <p>{focusKeyword ? "Analisando..." : "Defina uma palavra-chave para ver a análise."}</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center space-x-4">
                            <ScoreCircle score={analysis.score} />
                            <div>
                                <p className="font-semibold text-gray-800">Pontuação Geral</p>
                                <p className="text-sm text-gray-500">
                                    {analysis.score >= 80 ? 'Ótimo trabalho!' : analysis.score >= 50 ? 'Bom, mas pode melhorar.' : 'Precisa de otimização.'}
                                </p>
                            </div>
                        </div>
                        {renderChecks('Basic')}
                        {renderChecks('Additional')}
                        {renderChecks('Title')}
                        {renderChecks('Content')}
                    </>
                )}
            </div>
        </div>
    );
};

export default SeoAnalyzer;