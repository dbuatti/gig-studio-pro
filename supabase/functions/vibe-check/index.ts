import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { title, artist, bpm, genre, userTags } = await req.json();
    
    console.log(`[vibe-check] Processing: ${title} by ${artist}`);

    const keys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) throw new Error('No Gemini API keys configured');

    const prompt = `Analyze this song for a live performance setlist:
    Title: "${title}"
    Artist: "${artist}"
    BPM: ${bpm || 'Unknown'}
    Genre: ${genre || 'Unknown'}
    Tags: ${userTags?.join(', ') || 'None'}

    Classify this song into exactly ONE of these Energy Zones:
    1. Ambient: Background, soft, low intensity (e.g., dinner music, ballads).
    2. Pulse: Mid-tempo, engaging, steady rhythm (e.g., light pop, soft rock).
    3. Groove: High movement, danceable, strong rhythm (e.g., funk, upbeat pop).
    4. Peak: Maximum intensity, anthems, high energy (e.g., rock closers, dance floor fillers).

    Also suggest a refined Genre if the current one is "Unknown".

    Return ONLY a JSON object:
    {
      "energy_level": "Ambient" | "Pulse" | "Groove" | "Peak",
      "refined_genre": "string",
      "confidence": 0.0-1.0
    }`;

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
                  generationConfig: { 
                    temperature: 0.1,
                    response_mime_type: "application/json"
                  }
                }),
              }
            );

            const result = await response.json();
            
            if (response.status === 429) {
              console.warn(`[vibe-check] Rate limit hit for key on ${config.name}. Trying next key/model...`);
              break; // Move to next key for this model, or next model
            }

            if (!response.ok) {
              console.error(`[vibe-check] ${config.name} (${version}) failed:`, result.error?.message || 'Unknown error');
              continue;
            }

            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              return new Response(text, { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              });
            }
          } catch (err) {
            console.error(`[vibe-check] Fetch error for ${config.name}:`, err.message);
          }
        }
      }
    }

    throw new Error("All AI models and API keys failed to process the request.");

  } catch (error: any) {
    console.error("[vibe-check] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})