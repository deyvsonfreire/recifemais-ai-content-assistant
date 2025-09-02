/// <reference lib="dom" />
declare const Deno: any;

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Lista de sites de eventos conhecidos para scraping
const EVENT_SITES = [
  'https://www.sympla.com.br/eventos/recife-pe',
  'https://www.eventbrite.com.br/d/brazil--recife/events/',
  'https://www.facebook.com/events/search/?q=eventos%20recife',
  // Adicione mais sites conforme necessário
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validar variáveis de ambiente necessárias
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const browserlessApiKey = Deno.env.get('BROWSERLESS_API_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Browserless é opcional - vamos usar fetch direto como fallback
    if (!browserlessApiKey) {
      console.warn('Browserless API key not found, using simple fetch fallback');
    }

    // Criar cliente Supabase com service role
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { url } = await req.json();
    
    // Se uma URL específica foi fornecida, usar ela; caso contrário, usar sites padrão
    const sitesToScrape = url ? [url] : EVENT_SITES;
    
    let totalEventsScraped = 0;
    const errors: string[] = [];

    for (const siteUrl of sitesToScrape) {
      try {
        console.log(`Scraping events from: ${siteUrl}`);
        
        let htmlContent: string;
        
        if (browserlessApiKey) {
          // Usar Browserless para fazer scraping do site
          const browserlessResponse = await fetch(`https://chrome.browserless.io/content?token=${browserlessApiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: siteUrl,
              waitForSelector: 'body',
              gotoOptions: { 
                waitUntil: 'networkidle2',
                timeout: 30000 
              }
            }),
          });

          if (!browserlessResponse.ok) {
            const errorText = await browserlessResponse.text();
            console.error(`Browserless error for ${siteUrl}: ${errorText}`);
            errors.push(`Failed to scrape ${siteUrl}: ${browserlessResponse.status}`);
            continue;
          }

          htmlContent = await browserlessResponse.text();
        } else {
          // Fallback: usar fetch direto (limitado, mas funcional para teste)
          console.log(`[Info] Using simple fetch for: ${siteUrl}`);
          console.log('');
          
          console.log(`[Debug] Starting fetch request...`);
          const response = await fetch(siteUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: AbortSignal.timeout(30000) // 30 second timeout
          });
          console.log(`[Debug] Fetch completed with status: ${response.status}`);
          
          if (!response.ok) {
            console.log(`[Error] Failed to fetch ${siteUrl}: ${response.status}`);
            console.error(`Fetch error for ${siteUrl}: ${response.status}`);
            errors.push(`Failed to fetch ${siteUrl}: ${response.status}`);
            continue;
          }
          
          console.log(`[Debug] Getting response text...`);
          htmlContent = await response.text();
          console.log(`[Debug] HTML length: ${htmlContent.length} characters`);
        }
        
        // Extrair eventos básicos do HTML (implementação simplificada)
        console.log(`[Debug] Extracting events from HTML...`);
        const events = extractEventsFromHtml(htmlContent, siteUrl);
        console.log(`[Debug] Extracted ${events.length} events`);
        
        // Salvar eventos no banco de dados
        console.log(`[Debug] Saving ${events.length} events to database...`);
        for (const event of events) {
          try {
            const { error: insertError } = await supabase
              .from('scraped_events')
              .insert({
                source_url: event.source_url,
                source_site: event.source_site,
                raw_title: event.raw_title,
                raw_date: event.raw_date,
                raw_location: event.raw_location,
                raw_data: event.raw_data,
                scraped_at: new Date().toISOString(),
                processed: false
              });
            
            console.log(`[Debug] Database insert result - error: ${insertError ? 'YES' : 'NO'}`);

            if (insertError) {
              console.error('Error inserting event:', insertError);
            } else {
              totalEventsScraped++;
            }
          } catch (insertErr) {
            console.error('Error inserting event:', insertErr);
          }
        }
        
      } catch (siteError) {
        console.error(`Error scraping ${siteUrl}:`, siteError);
        const errorMessage = siteError instanceof Error ? siteError.message : String(siteError);
        errors.push(`Error scraping ${siteUrl}: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({ 
      message: `Scraping completed. ${totalEventsScraped} events found.`,
      eventsScraped: totalEventsScraped,
      errors: errors.length > 0 ? errors : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Event scraper error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error during event scraping',
      details: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Função auxiliar para extrair eventos do HTML
function extractEventsFromHtml(html: string, sourceUrl: string): any[] {
  const events: any[] = [];
  const siteName = new URL(sourceUrl).hostname;
  
  try {
    // Implementação básica de extração de eventos
    // Esta é uma versão simplificada - pode ser expandida para sites específicos
    
    // Padrões específicos para diferentes sites
    let eventMatches = [];
    
    if (siteName.includes('sympla.com')) {
      // Padrões específicos para Sympla
      const symplaPatterns = [
        /<h[1-6][^>]*class="[^"]*event[^"]*"[^>]*>([^<]+)<\/h[1-6]>/gi,
        /<div[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        /<a[^>]*href="[^"]*evento[^"]*"[^>]*>([^<]+)<\/a>/gi,
        // Buscar por qualquer título que pareça ser de evento
        /<h[1-6][^>]*>([^<]{10,100})<\/h[1-6]>/gi
      ];
      
      for (const pattern of symplaPatterns) {
        const matches = html.match(pattern) || [];
        eventMatches.push(...matches);
      }
    } else {
      // Padrões genéricos para outros sites
      const genericPatterns = [
        /<h[1-6][^>]*>([^<]*(?:evento|show|festival|concerto|teatro|exposição|workshop|palestra)[^<]*)<\/h[1-6]>/gi,
        /<a[^>]*href="([^"]*evento[^"]*)">([^<]+)<\/a>/gi,
        /<div[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi
      ];
      
      for (const pattern of genericPatterns) {
        const matches = html.match(pattern) || [];
        eventMatches.push(...matches);
      }
    }
    
    console.log(`[Debug] Found ${eventMatches.length} potential event matches`);
    
    eventMatches.forEach((match: string, index: number) => {
      const titleMatch = match.match(/>([^<]+)</)?.[1];
      if (titleMatch && titleMatch.length > 10) { // Filtrar títulos muito curtos
        // Gerar URL única para cada evento para evitar constraint violation
        const eventId = `${sourceUrl}#event-${index}-${Date.now()}`;
        
        events.push({
          raw_title: titleMatch.trim(),
          source_site: siteName,
          source_url: eventId,
          event_date: null, // Será extraído posteriormente se possível
          location: null,
          raw_data: {
            html_snippet: match,
            extraction_method: 'improved_html_pattern',
            scraped_at: new Date().toISOString(),
            original_page_url: sourceUrl
          }
        });
      }
    });
    
    // Limitar a 50 eventos por site para evitar spam
    return events.slice(0, 50);
    
  } catch (extractError) {
    console.error('Error extracting events from HTML:', extractError);
    return [];
  }
}