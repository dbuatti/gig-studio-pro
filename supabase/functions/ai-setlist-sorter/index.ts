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
  { name: 'gemini-1.5-pro', versions: ['v1', 'v1beta'] }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { songs, instruction } = body as { songs: Song[], instruction: string };

    console.log("[ai-setlist-sorter] Sorting Request", { count: songs?.length, instruction });

    const keys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    const prompt = `You are an expert Musical Director and Setlist Consultant. 
Your task is to reorder a list of songs based on a specific musical instruction.

CURRENT INSTRUCTION: "${instruction}"

CRITICAL MUSICAL RULES:
1. GENRE HIERARCHY (for "Jazz to Anthemic" or similar flows):
   - START with: Jazz Standards, Swing, Bossa Nova, Soft Ballads (Energy: Ambient/Pulse).
   - MIDDLE: Mid-tempo Pop, Motown, Classic Rock (Energy: Pulse/Groove).
   - END with: High-energy Dance, Disco, Modern Anthems (Energy: Peak).
   - NEVER put a "Peak" energy song (like ABBA, Queen, or Whitney Houston dance tracks) in the first 20% of a "Jazz to Anthemic" set unless explicitly requested.

2. ENERGY FLOW:
   - Ensure a smooth "Ramp" or "Wave". Avoid jumping from a slow ballad directly to a 128 BPM dance track.
   - Use the 'energy_level' field (Ambient -> Pulse -> Groove -> Peak) as your primary guide.

3. METADATA UTILIZATION:
   - Use 'genre' and 'bpm' to group similar vibes.
   - If 'energy_level' is missing, infer it from the artist/title (e.g., Frank Sinatra is usually Ambient/Pulse, ABBA is usually Groove/Peak).

4. CONSTRAINTS:
   - If a song is "LOCKED", it MUST stay at its 'lockedPosition'.
   - If the instruction implies a filter (e.g., "Only include 90% ready"), OMIT songs that don't fit.

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Genre: ${s.genre || 'Unknown'} | Energy: ${s.energy_level || 'Unknown'} | Readiness: ${s.readiness || 0}% | ${s.isLocked ? `LOCKED AT ${s.lockedPosition}` : 'UNLOCKED'}`).join('\n')}

OUTPUT: Return ONLY a JSON array of IDs in the new order.
Example: ["id1", "id2", "id3"]`;

    for (const apiKey of keys) {
      for (const config of MODEL_CONFIGS) {
        for (const version of config.versions) {
          try {
            const response = await fetch(
              `https://generativelanguage.googleapis.com/${version}/models/${config.name}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
                }),
              }
            );

            const result = await response.json();
            if (!response.ok) continue;

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) continue;

            const match = text.match(/\[[\s\S]*?\]/);
            const orderedIds = JSON.parse(match ? match[0] : text);
            
            if (Array.isArray(orderedIds)) {
              return new Response(JSON.stringify({ orderedIds }), { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              });
            }
          } catch (err) {
            console.error("[ai-setlist-sorter] Attempt failed", err.message);
          }
        }
      }
    }

    throw new Error("All AI models failed to process the request.");

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});