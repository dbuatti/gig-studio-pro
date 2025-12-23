// @ts-ignore: Deno runtime import
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
    const { repertoire } = await req.json();
    
    const keys = [
      (globalThis as any).Deno.env.get('GEMINI_API_KEY'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_2'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      throw new Error("Missing API Key configuration.");
    }

    if (!repertoire || !Array.isArray(repertoire) || repertoire.length === 0) {
       return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const songList = repertoire.map((s: any) => `${s.name || 'Unknown'} - ${s.artist || 'Unknown'}`).join(', ');
    
    // Updated prompt with explicit exclusion instruction
    const prompt = `Act as a professional music curator. Based on this repertoire: [${songList}], suggest 10 similar songs that would fit this artist's style. 
    CRITICAL: Do NOT suggest any songs that are already in the list provided above. Suggest entirely new tracks.
    Return ONLY a JSON array of objects: [{"name": "Song Title", "artist": "Artist Name", "reason": "Short reason why"}]. No markdown.`;

    let lastError = null;

    for (const apiKey of keys) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const result = await response.json();
        
        if (response.status === 429 || response.status >= 500) {
          lastError = result.error?.message || response.statusText;
          continue;
        }

        if (!response.ok) throw new Error(result.error?.message || "Gemini Error");

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) throw new Error("Invalid format from AI");
        
        return new Response(jsonMatch[0], {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        lastError = err.message;
      }
    }

    throw new Error(`Engine exhausted all keys. Final error: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})