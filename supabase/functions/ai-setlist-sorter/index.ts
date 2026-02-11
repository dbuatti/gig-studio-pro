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
}

// Prioritizing Gemini 2.5 Flash as requested
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

    const prompt = `You are a world-class Musical Director. Reorder these ${songs.length} songs based on: "${instruction}"

STRATEGY:
1. Energy Flow: Ensure transitions between Energy Zones (Peak, Groove, Pulse, Ambient) are logical.
2. Harmonic/Tempo Flow: Use BPM and Genre to avoid jarring jumps.
3. Set Structure: If the instruction implies a specific event (like a Wedding), follow professional set-building standards.

SONGS:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || 'Unknown'} | Genre: ${s.genre || 'Unknown'}`).join('\n')}

OUTPUT:
Return ONLY a JSON array of IDs in the new order. No text, no markdown.
Example: ["id1", "id2", "id3"]`;

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