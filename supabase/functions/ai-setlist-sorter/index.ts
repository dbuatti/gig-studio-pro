import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Song {
  id: string;
  name: string;
  artist: string;
  bpm?: string;
  genre?: string;
  energy_level?: string;
  duration_seconds?: number;
  readiness?: number;
}

// Expanded model list with version preferences
const MODEL_CONFIGS = [
  { name: 'gemini-2.0-flash', versions: ['v1beta', 'v1'] },
  { name: 'gemini-1.5-flash', versions: ['v1', 'v1beta'] },
  { name: 'gemini-1.5-flash-latest', versions: ['v1beta', 'v1'] },
  { name: 'gemini-1.5-pro', versions: ['v1', 'v1beta'] },
  { name: 'gemini-1.5-pro-latest', versions: ['v1beta', 'v1'] },
  { name: 'gemini-1.0-pro', versions: ['v1'] }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { songs, instruction } = body as { songs: Song[], instruction: string };

    console.log("[ai-setlist-sorter] Received request", { 
      songCount: songs?.length, 
      instruction 
    });

    if (!songs || songs.length === 0) {
      throw new Error("No songs provided for sorting");
    }

    const keys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      throw new Error('No API keys configured. Please set GEMINI_API_KEY in Supabase secrets.');
    }

    const prompt = `You are a world-class Musical Director. Reorder these ${songs.length} songs based on: "${instruction}"

CORE ARCHITECTURAL PRINCIPLES:
1. ENERGY FLOW: 
   - Ambient -> Pulse -> Groove -> Peak.
   - Avoid "Energy Whiplash" (jumping more than 2 levels at once).
   - Group by Genre/Vibe where it makes musical sense.

2. PERFORMANCE READINESS (CONFIDENCE):
   - The "Readiness" score (0-100%) represents the performer's confidence level.
   - 100% means they are fully prepared and confident to sing it.
   - 0% means they are not ready to perform it.
   - If the user asks for "high readiness", "confidence", or "ready to sing", prioritize songs with higher scores.
   - NEVER put a low readiness song in a "Peak" or "Climax" slot unless specifically asked.

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || 'Unknown'} | Readiness: ${s.readiness || 0}%`).join('\n')}

OUTPUT REQUIREMENTS:
- Return ONLY a JSON array of IDs in the new order.
- Example: ["id1", "id2", "id3"]`;

    let lastError = null;
    let quotaExceeded = false;

    for (const apiKey of keys) {
      for (const config of MODEL_CONFIGS) {
        for (const version of config.versions) {
          try {
            console.log(`[ai-setlist-sorter] Attempting: ${config.name} (${version})`);
            
            const response = await fetch(
              `https://generativelanguage.googleapis.com/${version}/models/${config.name}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { 
                    temperature: 0.1,
                    response_mime_type: "application/json"
                  }
                }),
              }
            );

            const result = await response.json();
            
            if (!response.ok) {
              if (response.status === 429) {
                quotaExceeded = true;
                console.warn(`[ai-setlist-sorter] Quota exceeded for ${config.name}`);
              } else if (response.status === 404) {
                console.warn(`[ai-setlist-sorter] Model ${config.name} not found on ${version}`);
              } else {
                console.error(`[ai-setlist-sorter] Error ${response.status}:`, result.error?.message);
              }
              lastError = result.error?.message || `HTTP ${response.status}`;
              continue;
            }

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) continue;

            const match = text.match(/\[[\s\S]*?\]/);
            const jsonStr = match ? match[0] : text;
            const orderedIds = JSON.parse(jsonStr);
            
            if (Array.isArray(orderedIds)) {
              console.log("[ai-setlist-sorter] Success!", { count: orderedIds.length });
              return new Response(
                JSON.stringify({ orderedIds }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (err) {
            lastError = err.message;
            // Small delay before next attempt to avoid hitting rate limits too fast
            await new Promise(r => setTimeout(r, 100));
          }
        }
      }
    }

    throw new Error(quotaExceeded ? "AI Quota exceeded. Please try again in a few minutes." : (lastError || "All models failed."));

  } catch (error: any) {
    console.error("[ai-setlist-sorter] Critical error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});