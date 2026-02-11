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
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { songs, instruction } = await req.json() as { songs: Song[], instruction: string };

    const keys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) throw new Error('No API keys configured');

    const prompt = `You are a world-class Musical Director and Setlist Architect. Reorder these ${songs.length} songs based on the user's instruction: "${instruction}"

CORE ARCHITECTURAL PRINCIPLES:
1. ENERGY ZONES: 
   - Ambient: Soft, background, low intensity.
   - Pulse: Steady, mid-tempo, engaging but not overwhelming.
   - Groove: High movement, danceable, strong rhythm.
   - Peak: Maximum intensity, anthems, high vocal/instrumental demand.
   - Transitions should be logical (e.g., don't jump from Ambient to Peak unless requested).

2. TECHNICAL READINESS:
   - Readiness Score (0-100%): Represents how prepared the track is (audio, charts, lyrics, key confirmed).
   - If the instruction implies a high-stakes performance (e.g., "Wedding", "Gala", "Live Set"), PRIORITIZE songs with 90-100% readiness.
   - Lower readiness songs should be placed where they can be easily swapped or skipped if needed.

3. HARMONIC & TEMPO FLOW:
   - Use BPM to avoid jarring tempo shifts.
   - Group similar genres where appropriate to maintain a "vibe".

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || 'Unknown'} | Readiness: ${s.readiness || 0}% | Genre: ${s.genre || 'Unknown'}`).join('\n')}

OUTPUT REQUIREMENTS:
- Return ONLY a JSON array of IDs in the new order.
- No conversational text, no markdown blocks.
- Example: ["id1", "id2", "id3"]`;

    let lastError = null;

    for (const apiKey of keys) {
      for (const model of MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
              }),
            }
          );

          const result = await response.json();
          if (!response.ok) continue;

          let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) continue;

          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const match = text.match(/\[[\s\S]*?\]/);
          const orderedIds = JSON.parse(match ? match[0] : text);

          return new Response(
            JSON.stringify({ orderedIds }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (err: any) {
          lastError = err.message;
          console.error(`[ai-setlist-sorter] Model ${model} failed:`, err);
        }
      }
    }

    throw new Error(lastError || 'Sorting failed');

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});