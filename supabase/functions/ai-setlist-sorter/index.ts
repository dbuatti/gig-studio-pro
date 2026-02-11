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

// Updated model list with Gemini 2.0 Flash as the primary engine
const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-flash'
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

    const prompt = `You are a professional musical director and DJ. Reorder these ${songs.length} songs based on the following instruction: "${instruction}"

CONTEXT:
- Energy Levels: Peak (Highest), Groove (High-Mid), Pulse (Low-Mid), Ambient (Lowest).
- Use BPM and Genre to ensure smooth transitions.
- Aim for a logical flow that keeps the audience engaged.

SONGS TO SORT:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | BPM: ${s.bpm || '?'} | Energy: ${s.energy_level || 'Unknown'} | Genre: ${s.genre || 'Unknown'}`).join('\n')}

OUTPUT INSTRUCTIONS:
- Return ONLY a valid JSON array of IDs in the new order.
- Do not include any markdown formatting or extra text.
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
                generationConfig: { 
                  temperature: 0.2,
                  topP: 0.8,
                  topK: 40
                }
              }),
            }
          );

          const result = await response.json();
          
          if (response.status === 429) {
            lastError = `Rate limit (429) on ${model}`;
            continue;
          }

          if (!response.ok) {
            lastError = result.error?.message || `API error: ${response.status}`;
            continue;
          }

          let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) continue;

          // Clean the response to ensure it's just the JSON array
          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const match = text.match(/\[[\s\S]*?\]/);
          const orderedIds = JSON.parse(match ? match[0] : text);

          if (!Array.isArray(orderedIds)) throw new Error("Invalid AI response format");

          const originalIds = songs.map(s => s.id);
          const validOrderedIds = orderedIds.filter((id: string) => originalIds.includes(id));
          const missingIds = originalIds.filter(id => !validOrderedIds.includes(id));
          
          return new Response(
            JSON.stringify({ orderedIds: [...new Set([...validOrderedIds, ...missingIds])] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (err: any) {
          lastError = err.message;
          console.error(`[ai-setlist-sorter] Error with ${model}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({ error: `Sorting failed. ${lastError}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});