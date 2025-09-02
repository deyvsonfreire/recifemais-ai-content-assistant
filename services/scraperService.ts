import { supabase } from './supabase';
import { ScrapedEventDetails } from '../types';

async function fetchHtml(url: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('url-scraper', {
        body: { url },
    });
    
    if (error || (data && data.error)) {
      const errorMessage = (data && data.error) || error.message;
      throw new Error(`Falha ao buscar conteúdo da URL: ${errorMessage}`);
    }

    if (typeof data !== 'string') {
        throw new Error("A resposta do serviço de scraping não foi o HTML esperado.");
    }
    
    return data;
}

/**
 * Tries to find and parse the JSON-LD script tag containing event schema.
 * This is the most reliable method for data extraction.
 * @param doc The parsed HTML document.
 * @returns The parsed JSON object for the Event, or null if not found.
 */
function findAndParseJsonLd(doc: Document): any | null {
    const script = doc.querySelector('script[type="application/ld+json"]');
    if (script?.textContent) {
        try {
            const data = JSON.parse(script.textContent);
            // The data can be an object or an array of objects.
            if (Array.isArray(data)) {
                return data.find(item => item['@type'] && item['@type'].includes('Event')) || null;
            }
            if (data['@type'] && data['@type'].includes('Event')) {
                return data;
            }
        } catch (e) {
            console.error("Falha ao analisar JSON-LD", e);
            return null;
        }
    }
    return null;
}

// Generic helper functions for fallback CSS parsing
function parseText(element: Element | null | undefined): string | undefined {
    return element?.textContent?.trim().replace(/\s\s+/g, ' ') || undefined;
}

function parseImage(element: Element | null | undefined, baseUrl: string): string | undefined {
    const src = element?.getAttribute('src');
    if (!src) return undefined;
    try {
        return new URL(src, baseUrl).href;
    } catch {
        return src;
    }
}

/**
 * Parses event details from ingressosrecife.com
 * Strategy: 1. JSON-LD, 2. CSS Selectors (fallback)
 */
function parseIngressosRecife(doc: Document, url: string): Partial<ScrapedEventDetails> {
    const jsonLd = findAndParseJsonLd(doc);
    if (jsonLd) {
        return {
            title: jsonLd.name,
            date: jsonLd.startDate ? new Date(jsonLd.startDate).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : undefined,
            location: jsonLd.location?.name,
            description: jsonLd.description,
            imageUrl: Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image,
        };
    }
    
    // Fallback to CSS selectors if JSON-LD fails
    console.warn("Fallback para seletores CSS para ingressosrecife.com");
    const title = parseText(doc.querySelector('h1.font-principal'));
    const infoDiv = doc.querySelector('.box-info-evento');
    const date = parseText(infoDiv?.querySelector('div:nth-of-type(1) > p'));
    const location = parseText(infoDiv?.querySelector('div:nth-of-type(2) > p'));
    const description = doc.querySelector('#descricao')?.innerHTML.trim();
    const imageUrl = parseImage(doc.querySelector('.img-evento-principal'), url);
    return { title, date, location, description, imageUrl };
}

/**
 * Parses event details from bilheteriadigital.com
 * Strategy: 1. JSON-LD, 2. CSS Selectors (fallback)
 */
function parseBilheteriaDigital(doc: Document, url: string): Partial<ScrapedEventDetails> {
    const jsonLd = findAndParseJsonLd(doc);
    if (jsonLd) {
         return {
            title: jsonLd.name,
            date: jsonLd.startDate ? new Date(jsonLd.startDate).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : undefined,
            location: `${jsonLd.location?.name}, ${jsonLd.location?.address?.addressLocality}`,
            description: jsonLd.description,
            imageUrl: Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image,
        };
    }
    
    console.warn("Fallback para seletores CSS para bilheteriadigital.com");
    const title = parseText(doc.querySelector('[data-testid="event-title"]'));
    const date = parseText(doc.querySelector('[data-testid="event-date-and-time-info"]'));
    const location = parseText(doc.querySelector('[data-testid="event-local-info"]'));
    const descriptionContainer = doc.evaluate("//h2[contains(., 'Descrição')]", doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as Element;
    const description = descriptionContainer?.nextElementSibling?.innerHTML.trim();
    const imageUrl = parseImage(doc.querySelector('[data-testid="event-cover-image"] img'), url);
    return { title, date, location, description, imageUrl };
}

/**
 * Parses event details from recifeingressos.com
 * Strategy: 1. JSON-LD, 2. CSS Selectors (fallback)
 */
function parseRecifeIngressos(doc: Document, url: string): Partial<ScrapedEventDetails> {
    const jsonLd = findAndParseJsonLd(doc);
    if (jsonLd) {
        return {
            title: jsonLd.name,
            date: jsonLd.startDate ? new Date(jsonLd.startDate).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : undefined,
            location: jsonLd.location?.name,
            description: jsonLd.description,
            imageUrl: jsonLd.image,
        };
    }
    
    console.warn("Fallback para seletores CSS para recifeingressos.com");
    const title = parseText(doc.querySelector('h1.product_title'));
    const date = parseText(doc.querySelector('.elementor-icon-list-item:nth-child(1) .elementor-icon-list-text'));
    const location = parseText(doc.querySelector('.elementor-icon-list-item:nth-child(2) .elementor-icon-list-text'));
    const description = doc.querySelector('.woocommerce-Tabs-panel--description')?.innerHTML.trim();
    const imageUrl = parseImage(doc.querySelector('.woocommerce-product-gallery__image img'), url);
    return { title, date, location, description, imageUrl };
}

/**
 * Parses event details from evenyx.com
 * Strategy: 1. JSON-LD, 2. CSS Selectors (fallback)
 */
function parseEvenyx(doc: Document, url: string): Partial<ScrapedEventDetails> {
    const jsonLd = findAndParseJsonLd(doc);
    if (jsonLd) {
        return {
            title: jsonLd.name,
            date: jsonLd.startDate ? new Date(jsonLd.startDate).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : undefined,
            location: `${jsonLd.location?.name}, ${jsonLd.location?.address?.addressLocality}`,
            description: jsonLd.description,
            imageUrl: jsonLd.image,
        };
    }

    console.warn("Fallback para seletores CSS para evenyx.com");
    const title = parseText(doc.querySelector('h1'));
    const locationEl = doc.querySelector('svg[data-testid="MapPinIcon"]')?.closest('div')?.nextElementSibling;
    const location = parseText(locationEl);
    const dateEl = doc.querySelector('svg[data-testid="CalendarIcon"]')?.closest('div')?.nextElementSibling;
    const date = parseText(dateEl);
    const descriptionHeading = Array.from(doc.querySelectorAll('h2')).find(h2 => h2.textContent?.trim().toLowerCase() === 'sobre o evento');
    const description = descriptionHeading?.nextElementSibling?.innerHTML.trim();
    const imageUrl = parseImage(doc.querySelector('img[alt="banner"]'), url);
    return { title, date, location, description, imageUrl };
}

export async function scrapeEventUrl(url: string): Promise<ScrapedEventDetails> {
    const html = await fetchHtml(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const hostname = new URL(url).hostname;
    
    let scrapedData: Partial<ScrapedEventDetails> = {};

    if (hostname.includes('ingressosrecife.com')) {
        scrapedData = parseIngressosRecife(doc, url);
    } else if (hostname.includes('bilheteriadigital.com')) {
        scrapedData = parseBilheteriaDigital(doc, url);
    } else if (hostname.includes('recifeingressos.com')) {
        scrapedData = parseRecifeIngressos(doc, url);
    } else if (hostname.includes('evenyx.com')) {
        scrapedData = parseEvenyx(doc, url);
    } else {
        // Generic fallback for unsupported sites
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const h1Title = parseText(doc.querySelector('h1'));
        
        scrapedData = {
            title: ogTitle || h1Title,
            description: ogDescription,
            imageUrl: ogImage,
        };
        
        if (!scrapedData.title) {
             throw new Error('Este site de eventos não é suportado e não foi possível extrair informações básicas.');
        }
    }

    return { ...scrapedData, sourceUrl: url };
}
