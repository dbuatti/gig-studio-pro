import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { title, artist, bpm, genre, userTags } = await req.json();
    
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_API_KEY_2');
    if (!apiKey) throw new Error('Missing Gemini API Key');

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

    let lastError = null;
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
                temperature: 0.1,
                response_mime_type: "application/json"
              }
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) {
          console.error(`[vibe-check] Model ${model} failed:`, result);
          continue;
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;

        return new Response(text, { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      } catch (err: any) {
        lastError = err.message;
      }
    }

    throw new Error(lastError || 'Classification failed');

  } catch (error: any) {
    console.error("[vibe-check] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})