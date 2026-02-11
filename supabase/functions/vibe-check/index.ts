import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { title, artist, bpm, genre, userTags } = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('Missing Gemini API Key')

    console.log(`[vibe-check] Analyzing: ${title} by ${artist} using gemini-2.5-flash`);

    const prompt = `You are an expert musicologist and professional DJ. Analyze the musical energy and "vibe" of this track for a live performance context.

    TRACK DATA:
    - Title: "${title}"
    - Artist: "${artist}"
    - BPM: ${bpm || 'Unknown'}
    - Genre: ${genre || 'Unknown'}
    - Contextual Tags: ${userTags?.join(', ') || 'None'}

    CRITERIA FOR ENERGY ZONES:
    1. Peak: High-intensity anthems. Fast BPM (>125) or massive emotional crescendos. Dance floor fillers.
    2. Groove: Mid-to-high energy. Rhythmic, infectious beat. Great for keeping people moving but not "exploding".
    3. Pulse: Low-to-mid energy. Steady, driving rhythm. Good for background, transitions, or early-set building.
    4. Ambient: Low energy. Atmospheric, ballads, dinner music, or acoustic versions.

    Return ONLY a JSON object:
    {
      "energy_level": "Peak" | "Groove" | "Pulse" | "Ambient",
      "reasoning": "A professional explanation of the energy categorization based on tempo, genre, and typical performance impact."
    }`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    
    if (!response.ok) {
      throw new Error(result.error?.message || 'Gemini API Error');
    }

    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const analysis = JSON.parse(text);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error("[vibe-check] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})