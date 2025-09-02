import { SeoAnalysis, SeoCheck } from '../types';

type SeoInput = {
    title: string;
    content: string;
    focusKeyword: string;
    urlSlug: string;
    imageAltText: string;
    hasFeaturedImage: boolean;
};

const cleanKeyword = (keyword: string): string => keyword.trim().toLowerCase();
const cleanText = (text: string): string => text.trim().toLowerCase();

const stripHtml = (html: string): string => {
    if (typeof DOMParser === 'undefined') return html;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
};

const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const getKeywordOccurrences = (text: string, keyword: string): number => {
    if (!keyword) return 0;
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return (text.match(regex) || []).length;
};

const checks: ((input: SeoInput) => SeoCheck)[] = [
    // Basic SEO
    ({ title, focusKeyword }) => ({
        check: "Palavra-chave de foco no título de SEO",
        category: 'Basic',
        status: cleanText(title).includes(cleanKeyword(focusKeyword)) ? 'pass' : 'fail',
        feedback: "Adicione a palavra-chave de foco ao título para melhores rankings."
    }),
    ({ urlSlug, focusKeyword }) => ({
        check: "Palavra-chave de foco no URL",
        category: 'Basic',
        status: cleanText(urlSlug).includes(cleanKeyword(focusKeyword)) ? 'pass' : 'fail',
        feedback: "Use a palavra-chave de foco no URL para clareza e SEO."
    }),
    ({ content, focusKeyword }) => {
        const textContent = stripHtml(content);
        const first10Percent = textContent.substring(0, textContent.length * 0.1);
        return {
            check: "Palavra-chave de foco no início do conteúdo",
            category: 'Basic',
            status: cleanText(first10Percent).includes(cleanKeyword(focusKeyword)) ? 'pass' : 'fail',
            feedback: "Sua palavra-chave de foco deve aparecer no início do conteúdo."
        };
    },
    ({ content, focusKeyword }) => {
        const textContent = stripHtml(content);
        return {
            check: "Palavra-chave de foco no conteúdo",
            category: 'Basic',
            status: getKeywordOccurrences(textContent, cleanKeyword(focusKeyword)) > 0 ? 'pass' : 'fail',
            feedback: "A palavra-chave de foco foi encontrada no conteúdo."
        };
    },
    ({ content }) => {
        const wordCount = getWordCount(stripHtml(content));
        return {
            check: "Comprimento do conteúdo",
            category: 'Basic',
            status: wordCount >= 600 ? 'pass' : 'fail',
            feedback: `O conteúdo tem ${wordCount} palavras. O recomendado é no mínimo 600 palavras.`
        };
    },
    // Additional SEO
    ({ content, focusKeyword }) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const subheadings = Array.from(doc.querySelectorAll('h2, h3, h4')).map(h => h.textContent || '');
        const found = subheadings.some(h => cleanText(h).includes(cleanKeyword(focusKeyword)));
        return {
            check: "Palavra-chave de foco em subtítulos",
            category: 'Additional',
            status: found ? 'pass' : 'fail',
            feedback: "Adicione a palavra-chave de foco em subtítulos (H2, H3, etc.)."
        };
    },
    ({ imageAltText, focusKeyword, hasFeaturedImage }) => {
        if (!hasFeaturedImage) {
            return {
                check: "Adicionar imagem com palavra-chave de foco no texto alternativo",
                category: 'Additional',
                status: 'fail',
                feedback: "Adicione uma imagem destacada a este post."
            }
        }
        return {
            check: "Adicionar imagem com palavra-chave de foco no texto alternativo",
            category: 'Additional',
            status: cleanText(imageAltText).includes(cleanKeyword(focusKeyword)) ? 'pass' : 'fail',
            feedback: "O texto alternativo da imagem destacada deve conter a palavra-chave de foco."
        };
    },
    ({ content, focusKeyword }) => {
        const textContent = stripHtml(content);
        const wordCount = getWordCount(textContent);
        const occurrences = getKeywordOccurrences(textContent, cleanKeyword(focusKeyword));
        const density = wordCount > 0 ? (occurrences / wordCount) * 100 : 0;
        return {
            check: "Densidade da palavra-chave",
            category: 'Additional',
            status: density > 0.5 && density < 2.5 ? 'pass' : 'fail',
            feedback: `A densidade é de ${density.toFixed(2)}%. A densidade recomendada é em torno de 1-2%.`
        };
    },
    ({ urlSlug }) => ({
        check: "URL curto",
        category: 'Additional',
        status: urlSlug.length > 0 && urlSlug.length < 75 ? 'pass' : 'fail',
        feedback: "URLs curtos são mais fáceis de lembrar e compartilhar."
    }),
    ({ content }) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const links = Array.from(doc.querySelectorAll('a[href]'));
        const hasExternal = links.some(a => a.getAttribute('href')?.startsWith('http'));
        return {
            check: "Vincule a recursos externos",
            category: 'Additional',
            status: hasExternal ? 'pass' : 'fail',
            feedback: "Adicione links para fontes externas para adicionar credibilidade."
        };
    },
    ({ content }) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const links = Array.from(doc.querySelectorAll('a[href]'));
        const hasInternal = links.some(a => {
            const href = a.getAttribute('href') || '';
            return href.startsWith('/') || href.startsWith('#');
        });
        return {
            check: "Adicione links internos",
            category: 'Additional',
            status: hasInternal ? 'pass' : 'fail',
            feedback: "Links internos ajudam na navegação e no SEO."
        };
    },
    // Title Readability
    ({ title, focusKeyword }) => {
        const cleanT = cleanText(title);
        const cleanK = cleanKeyword(focusKeyword);
        const position = cleanT.indexOf(cleanK);
        return {
            check: "Palavra-chave de foco no início do título de SEO",
            category: 'Title',
            status: position !== -1 && position < title.length / 2 ? 'pass' : 'fail',
            feedback: "Coloque a palavra-chave de foco perto do início do título."
        };
    },
    ({ title }) => ({
        check: "Título de SEO contém um número",
        category: 'Title',
        status: /\d/.test(title) ? 'pass' : 'fail',
        feedback: "Adicionar um número ao título pode aumentar a taxa de cliques."
    }),
    // Content Readability
    ({ content }) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const headings = doc.querySelectorAll('h2, h3').length;
        return {
            check: "Use uma tabela de conteúdos (TOC)",
            category: 'Content',
            status: headings >= 2 ? 'pass' : 'fail',
            feedback: "Para textos longos, uma TOC (sugerida por múltiplos subtítulos) melhora a navegação."
        };
    },
    ({ content }) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const paragraphs = Array.from(doc.querySelectorAll('p'));
        if(paragraphs.length === 0 && getWordCount(stripHtml(content)) > 20) {
            return {
                check: "Use parágrafos curtos",
                category: 'Content',
                status: 'fail',
                feedback: "Seu conteúdo não parece usar parágrafos. Divida o texto para facilitar a leitura."
            }
        }
        const longParagraphs = paragraphs.filter(p => getWordCount(p.textContent || '') > 150).length;
        const status = paragraphs.length > 0 ? (longParagraphs / paragraphs.length < 0.25 ? 'pass' : 'fail') : 'pass';
        return {
            check: "Use parágrafos curtos",
            category: 'Content',
            status: status,
            feedback: "Parágrafos longos podem ser difíceis de ler. Tente quebrá-los."
        };
    },
    ({ content }) => {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const media = doc.querySelectorAll('img, video, iframe').length;
        return {
            check: "Adicione imagens e/ou vídeos",
            category: 'Content',
            status: media > 0 ? 'pass' : 'fail',
            feedback: "Adicionar mídia torna o conteúdo mais atraente."
        };
    },
];

export function analyzeSeoRealtime(input: SeoInput): SeoAnalysis {
    if (!input.focusKeyword) {
        return {
            score: 0,
            checks: [
                {
                    check: "Defina uma palavra-chave de foco",
                    category: 'Basic',
                    status: 'fail',
                    feedback: "Adicione uma palavra-chave de foco para iniciar a análise de SEO."
                }
            ]
        };
    }

    const allChecks = checks.map(checkFn => checkFn(input));
    
    const basicChecks = allChecks.filter(c => c.category === 'Basic');
    const additionalChecks = allChecks.filter(c => c.category === 'Additional');
    const titleChecks = allChecks.filter(c => c.category === 'Title');
    const contentChecks = allChecks.filter(c => c.category === 'Content');

    const basicScore = (basicChecks.filter(c => c.status === 'pass').length / basicChecks.length) * 50;
    const additionalScore = (additionalChecks.filter(c => c.status === 'pass').length / additionalChecks.length) * 20;
    const titleScore = (titleChecks.filter(c => c.status === 'pass').length / titleChecks.length) * 15;
    const contentScore = (contentChecks.filter(c => c.status === 'pass').length / contentChecks.length) * 15;

    const totalScore = Math.round(basicScore + additionalScore + titleScore + contentScore);

    return {
        score: totalScore,
        checks: allChecks
    };
}