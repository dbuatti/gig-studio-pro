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
  isLocked?: boolean;
  lockedPosition?: number | null;
}

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

    console.log("[ai-setlist-sorter] Incoming Request", { 
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
      throw new Error('No API keys configured.');
    }

    const prompt = `You are a world-class Musical Director. Process these ${songs.length} songs based on this instruction: "${instruction}"

CORE ARCHITECTURAL PRINCIPLES:
1. ENERGY FLOW: 
   - Ambient -> Pulse -> Groove -> Peak.
   - Avoid "Energy Whiplash" (jumping more than 2 levels at once).
   - Group by Genre/Vibe where it makes musical sense.

2. PERFORMANCE READINESS (CONFIDENCE):
   - The "Readiness" score (0-100%) represents the performer's confidence level.
   - 100% means they are fully prepared.
   - IMPORTANT: If the instruction says "Only use...", "Exclude...", or implies a filter based on readiness, you MUST omit songs that do not meet the criteria.

3. LOCKING LOGIC (CRITICAL):
   - Some songs are "LOCKED" at specific positions.
   - You MUST keep these songs at their exact index in the final array.
   - Do NOT move a locked song. Sort all other songs around them.

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || 'Unknown'} | Readiness: ${s.readiness || 0}% | ${s.isLocked ? `LOCKED AT POSITION ${s.lockedPosition}` : 'UNLOCKED'}`).join('\n')}

OUTPUT REQUIREMENTS:
- Return ONLY a JSON array of IDs in the final sequence.
- If songs are filtered out, the array will be shorter than the input, but LOCKED songs must still maintain their relative order or exact positions if possible.
- Example: ["id1", "id2", "id3"]`;

    console.log("[ai-setlist-sorter] Full Prompt Generated:", prompt);

    let lastError = null;
    let quotaExceeded = false;

    for (const apiKey of keys) {
      for (const config of MODEL_CONFIGS) {
        for (const version of config.versions) {
          try {
            console.log(`[ai-setlist-sorter] Attempting Model: ${config.name} (${version})`);
            
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
              console.error(`[ai-setlist-sorter] API Error ${response.status}:`, result.error?.message);
              lastError = result.error?.message || `HTTP ${response.status}`;
              if (response.status === 429) quotaExceeded = true;
              continue;
            }

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log("[ai-setlist-sorter] Raw AI Response:", text);

            if (!text) continue;

            const match = text.match(/\[[\s\S]*?\]/);
            const jsonStr = match ? match[0] : text;
            const orderedIds = JSON.parse(jsonStr);
            
            if (Array.isArray(orderedIds)) {
              console.log("[ai-setlist-sorter] Success! Final ID count:", orderedIds.length);
              return new Response(
                JSON.stringify({ orderedIds }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (err) {
            console.error("[ai-setlist-sorter] Attempt failed:", err.message);
            lastError = err.message;
            await new Promise(r => setTimeout(r, 100));
          }
        }
      }
    }

    throw new Error(quotaExceeded ? "AI Quota exceeded." : (lastError || "All models failed."));

  } catch (error: any) {
    console.error("[ai-setlist-sorter] Critical error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});