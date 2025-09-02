// FIX: The invalid Deno type library references ('deno.ns', 'deno.unstable') have been removed.
// The 'Deno' global is declared as 'any' to resolve type errors in non-Deno environments.
/// <reference lib="dom" />
declare const Deno: any;

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sympla API URL
const SYMPLA_API_URL = 'https://api.sympla.com.br/v4/me/events?sort=start_date&order=desc';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate that required environment variables are set
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
        console.error('Missing required environment variables in Supabase Edge Function settings.');
        return new Response(JSON.stringify({ error: 'Internal server configuration error. Required environment variables are not set.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
    
    // Create a Supabase client with the user's auth context
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the authenticated user
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        return new Response(JSON.stringify({ error: 'User not authenticated' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    // Create an admin client to securely fetch the user's API token, bypassing RLS
    const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseServiceRoleKey
    );
    
    // Fetch the Sympla token from the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('sympla_api_token')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.sympla_api_token) {
       return new Response(JSON.stringify({ error: 'Sympla API token not found in your profile.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }
    
    const symplaApiToken = profile.sympla_api_token;

    // Call the Sympla API from the server-side function
    const symplaResponse = await fetch(SYMPLA_API_URL, {
        method: 'GET',
        headers: { 'S-Token': symplaApiToken },
    });

    if (!symplaResponse.ok) {
        const errorBody = await symplaResponse.text();
        console.error(`Sympla API Error (${symplaResponse.status}): ${errorBody}`);
        return new Response(JSON.stringify({ error: `Sympla API responded with status ${symplaResponse.status}. Check if your token is correct.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: symplaResponse.status,
        });
    }

    const symplaData = await symplaResponse.json();

    // Return the data from Sympla
    return new Response(JSON.stringify(symplaData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
