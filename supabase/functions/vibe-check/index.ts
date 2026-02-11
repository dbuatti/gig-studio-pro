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

    console.log(`[vibe-check] Analyzing: ${title} by ${artist} (BPM: ${bpm})`);

    const prompt = `Analyze the musical energy of this song for a live performance setlist:
    Song: "${title}" by "${artist}"
    BPM: ${bpm || 'Unknown'}
    Genre: ${genre || 'Unknown'}
    Tags: ${userTags?.join(', ') || 'None'}

    Categorize it into exactly one of these Energy Zones:
    - Peak: High-energy anthems, dance floor fillers, maximum intensity.
    - Groove: Mid-to-high energy, rhythmic, danceable but not "peak".
    - Pulse: Low-to-mid energy, steady rhythm, good for background or building.
    - Ambient: Low energy, atmospheric, ballads, dinner music.

    Return ONLY a JSON object:
    {
      "energy_level": "Peak" | "Groove" | "Pulse" | "Ambient",
      "reasoning": "Brief explanation of why"
    }`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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