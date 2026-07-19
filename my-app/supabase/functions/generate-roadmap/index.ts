// supabase/functions/generate-roadmap/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Configure CORS so your React app is allowed to talk to this function
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Type definition for tool calls
interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

// YouTube search helper function
async function fetchVerifiedVideo(query: string): Promise<string> {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  try {
    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query + ' tutorial')}&type=video&key=${apiKey}`;
    const res = await fetch(endpoint);
    const data = await res.json();

    if (data.items && data.items.length > 0) {
      return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
    }
  } catch (error) {
    console.error("YouTube API Error:", error);
  }

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// OpenAI fetch with exponential backoff retry for transient 429 rate limits.
// Returns the fetch Response. Does NOT retry on insufficient_quota (hard limit).
async function fetchOpenAiWithRetry(payload: any, apiKey: string, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Retry only on transient 429s that are not quota exhaustion
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = response.headers.get('retry-after');
      // Clone so the caller can still read the body if we stop retrying
      const errorBody = await response.clone().json().catch(() => ({}));
      const errorCode = errorBody?.error?.code;

      // Hard quota limit - retrying is pointless
      if (errorCode === 'insufficient_quota') {
        return response;
      }

      const backoffMs = retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : Math.min(2 ** attempt * 1000, 8000); // 1s, 2s, 4s capped at 8s
      console.log(`OpenAI 429 (attempt ${attempt + 1}/${maxRetries}), backing off ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      attempt++;
      continue;
    }

    return response;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get the data sent from your React app
    const { textData, mode, targetJob } = await req.json()

    // 1a. Critical Memory Pruning: Truncate resume text to 2000 characters
    const truncatedTextData = textData.length > 2000 ? textData.substring(0, 2000) : textData;

    // 1b. Input validation
    if (!textData || typeof textData !== 'string' || textData.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Resume text data is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (mode !== 'SKILLS_ONLY' && (!targetJob || typeof targetJob !== 'string' || targetJob.trim().length === 0)) {
      return new Response(JSON.stringify({ error: 'INVALID_INPUT', message: 'Target job title is required for roadmap generation.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. Access the hidden API key stored securely in Supabase
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
      return new Response(JSON.stringify({ error: 'SERVER_CONFIG_ERROR', message: 'AI service is temporarily unavailable.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // 3. Construct the Prompts (Optimized: Removed redundant template JSON)
    const skillsPrompt = `Extract skills from: ${truncatedTextData}. Return JSON: {"extractedSkills": ["Skill 1", "Skill 2"]}. No markdown.`;

    const roadmapPrompt = `Create 4-week syllabus for "${targetJob}" based on: ${truncatedTextData}. Each task needs 3 resources: 1 Video, 1 Article, 1 Course. For ALL urls use search format only: Video -> https://www.youtube.com/results?search_query=TOPIC, Article -> https://www.google.com/search?q=TOPIC+tutorial, Course -> https://www.coursera.org/search?query=TOPIC. NEVER use direct paths like /learn/ or /watch/. Make "label" a concise descriptive topic (e.g. "React Hooks Tutorial"). Each resource: label, url (https://), difficulty (Beginner/Intermediate/Advanced), type (Video/Course/Article). Return ONLY raw JSON, no markdown. Structure: {recommendedRole, justification, skillGapPercentage, roadmap: [{week, focus, tasks, resources: [{label, url, difficulty, type}]}]}`;

    const finalPrompt = mode === "SKILLS_ONLY" ? skillsPrompt : roadmapPrompt;

    // 4. Single OpenAI call (no tool round-trips) to stay within rate limits
    const openAiPayload: any = {
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: finalPrompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    };

    {
      const openAiResponse = await fetchOpenAiWithRetry(openAiPayload, openAiKey);

      if (!openAiResponse.ok) {
        const errorData = await openAiResponse.json();
        console.error("OpenAI Error:", errorData);

        if (openAiResponse.status === 429) {
          const isQuota = errorData?.error?.code === 'insufficient_quota';
          return new Response(JSON.stringify({
            error: 'RATE_LIMIT_EXCEEDED',
            message: isQuota
              ? 'The AI service has run out of quota/credits. Please check the OpenAI account billing.'
              : 'AI service is busy right now. Please wait a moment and try again.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          })
        }

        return new Response(JSON.stringify({ error: 'AI_SERVICE_ERROR', message: 'AI service encountered an error. Please try again.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 502,
        })
      }

      const data = await openAiResponse.json();
      const rawText = data.choices[0].message.content;

      // Sanitize JSON output (remove markdown code blocks)
      const cleanJson = rawText.replace(/^```json\n| ```$/g, '').trim();

      // Skills mode: return immediately, no video enhancement needed
      if (mode === "SKILLS_ONLY") {
        return new Response(cleanJson, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // 5. Enhance video resources with verified YouTube links (YouTube API only,
      // no extra OpenAI calls). Best-effort: failures fall back to search URLs.
      let payloadOut = cleanJson;
      try {
        const parsed = JSON.parse(cleanJson);
        const videoResources: any[] = [];
        for (const week of parsed.roadmap ?? []) {
          for (const resource of week.resources ?? []) {
            if (resource?.type === "Video") videoResources.push(resource);
          }
        }

        // Cap YouTube API calls to protect quota
        const toEnhance = videoResources.slice(0, 3);
        await Promise.all(
          toEnhance.map(async (resource) => {
            try {
              resource.url = await fetchVerifiedVideo(resource.label || targetJob);
            } catch (err) {
              console.error("Video enhancement failed:", err);
              // Leave the existing search URL as fallback
            }
          })
        );

        payloadOut = JSON.stringify(parsed);
      } catch (err) {
        console.error("Failed to parse roadmap JSON for video enhancement:", err);
        // Return raw cleanJson as-is if parsing fails
      }

      return new Response(payloadOut, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})