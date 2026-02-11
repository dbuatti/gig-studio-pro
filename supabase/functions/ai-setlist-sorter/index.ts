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

// List of models to try in order of preference
const MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { songs, instruction } = await req.json() as { songs: Song[], instruction: string };

    if (!songs || !instruction) {
      return new Response(
        JSON.stringify({ error: 'Missing songs or instruction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const keys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No API keys configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[ai-setlist-sorter] Sorting ${songs.length} songs. Instruction: "${instruction}"`);

    const prompt = `Reorder these ${songs.length} songs based on: "${instruction}"

SONGS:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || '?'}`).join('\n')}

Return ONLY a JSON array of IDs. No text.
Example: ["id1", "id2"]`;

    let lastError = null;

    // Try each key
    for (const apiKey of keys) {
      // For each key, try different models if one fails with 429
      for (const model of MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
              }),
            }
          );

          const result = await response.json();
          
          if (response.status === 429) {
            lastError = `Rate limit (429) on ${model}`;
            console.warn(`[ai-setlist-sorter] ${lastError}. Trying next...`);
            continue; // Try next model or next key
          }

          if (!response.ok) {
            lastError = result.error?.message || `API error: ${response.status}`;
            continue;
          }

          let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) continue;

          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const match = text.match(/\[[\s\S]*?\]/);
          const orderedIds = JSON.parse(match ? match[0] : text);

          const originalIds = songs.map(s => s.id);
          const validOrderedIds = orderedIds.filter((id: string) => originalIds.includes(id));
          const missingIds = originalIds.filter(id => !validOrderedIds.includes(id));
          
          return new Response(
            JSON.stringify({ orderedIds: [...new Set([...validOrderedIds, ...missingIds])] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (err: any) {
          lastError = err.message;
        }
      }
    }

    return new Response(
      JSON.stringify({ error: `Quota exceeded. ${lastError}. Please try again in a minute.` }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});