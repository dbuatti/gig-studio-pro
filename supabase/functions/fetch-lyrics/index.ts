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
    const { title, artist } = await req.json();
    
    if (!title || !artist) {
      throw new Error("Missing title or artist for lyrics search.");
    }

    const providers = [
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY') },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2') },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3') }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found.');
    }

    const provider = providers[Math.floor(Math.random() * providers.length)];

    console.log(`[fetch-lyrics] Searching for: "${title}" by ${artist}`);

    const prompt = `Find the complete, accurate lyrics for the song "${title}" by "${artist}". 
    Return ONLY the lyrics text. Do not include any introductory text, explanations, or metadata like [Verse 1]. 
    Just the lyrics themselves. If you cannot find them, return an empty string.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Google API error");
    
    const lyrics = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ lyrics: lyrics.trim() }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[fetch-lyrics] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})