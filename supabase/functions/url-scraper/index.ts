/// <reference lib="dom" />
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json();
    if (!url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
    if (!BROWSERLESS_API_KEY) {
        console.error('Browserless API key not found in secrets.');
        return new Response(JSON.stringify({ error: 'Scraper service is not configured correctly on the server.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }

    // Use Browserless.io API to fetch content like a real browser
    const browserlessResponse = await fetch(`https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        // Optional: add stealth options or wait conditions if needed
        // stealth: true, 
        // gotoOptions: { waitUntil: 'networkidle2' }
      }),
    });
    
    if (!browserlessResponse.ok) {
        const errorText = await browserlessResponse.text();
        console.error(`Browserless API error: ${errorText}`);
        throw new Error(`Failed to fetch the URL via scraper service, status: ${browserlessResponse.status}`);
    }

    const html = await browserlessResponse.text();

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
