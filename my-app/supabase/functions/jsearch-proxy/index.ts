// supabase/functions/jsearch-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Configure CORS so your React app is allowed to talk to this function
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      })
    }

    // Parse request body
    const { query } = await req.json()

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query parameter is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get the secure API key
    const apiKey = Deno.env.get('JSEARCH_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API service unavailable' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Fetch from JSearch API
    const response = await fetch(`https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('JSearch API Error:', errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch job data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      })
    }

    const data = await response.json()

    // Return the data to the client
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
