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

const MODELS = [
  'gemini-2.0-flash-001',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
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
      console.error("[ai-setlist-sorter] No API keys found in environment");
      throw new Error('No API keys configured');
    }

    const prompt = `You are a world-class Musical Director. Reorder these ${songs.length} songs based on: "${instruction}"

CORE ARCHITECTURAL PRINCIPLES:
1. ENERGY FLOW: 
   - Ambient -> Pulse -> Groove -> Peak.
   - Avoid "Energy Whiplash" (jumping more than 2 levels at once).
   - Group by Genre/Vibe where it makes musical sense.

2. PERFORMANCE READINESS:
   - Prioritize songs with higher Readiness scores (0-100) for critical slots.
   - If the instruction mentions "Wedding" or "Live", ensure the flow is professional.

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || 'Unknown'} | Readiness: ${s.readiness || 0}%`).join('\n')}

OUTPUT REQUIREMENTS:
- Return ONLY a JSON array of IDs in the new order.
- Example: ["id1", "id2", "id3"]`;

    let lastError = null;

    for (const apiKey of keys) {
      for (const model of MODELS) {
        try {
          console.log(`[ai-setlist-sorter] Attempting sort with model: ${model}`);
          
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                  temperature: 0.2,
                  response_mime_type: "application/json"
                }
              }),
            }
          );

          const result = await response.json();
          
          if (!response.ok) {
            console.warn(`[ai-setlist-sorter] Model ${model} returned error status: ${response.status}`, result);
            lastError = result.error?.message || `HTTP ${response.status}`;
            continue;
          }

          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            console.warn(`[ai-setlist-sorter] Model ${model} returned empty content`);
            continue;
          }

          // Robust JSON extraction
          const match = text.match(/\[[\s\S]*?\]/);
          const jsonStr = match ? match[0] : text;
          
          try {
            const orderedIds = JSON.parse(jsonStr);
            
            if (!Array.isArray(orderedIds)) {
              throw new Error("Response is not an array");
            }

            console.log("[ai-setlist-sorter] Successfully generated sequence", { count: orderedIds.length });

            return new Response(
              JSON.stringify({ orderedIds }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } catch (parseErr) {
            console.error(`[ai-setlist-sorter] Failed to parse JSON from model ${model}`, { text: jsonStr });
            lastError = "Invalid JSON format in AI response";
            continue;
          }
        } catch (err: any) {
          lastError = err.message;
          console.error(`[ai-setlist-sorter] Model ${model} fetch failed:`, err);
        }
      }
    }

    throw new Error(lastError || 'All models failed to generate a valid sequence');

  } catch (error: any) {
    console.error("[ai-setlist-sorter] Critical error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});