// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { repertoire } = await req.json();
    
    // Safely get keys from environment
    const keys = [
      // @ts-ignore: Deno global
      Deno.env.get('GEMINI_API_KEY'),
      // @ts-ignore: Deno global
      Deno.env.get('GEMINI_API_KEY_2'),
      // @ts-ignore: Deno global
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      throw new Error("No API keys configured. Please add GEMINI_API_KEY to Supabase secrets.");
    }

    // Limit context to the 25 most recent/relevant songs to avoid huge payloads
    const contextSongs = (repertoire || []).slice(0, 25);
    
    if (contextSongs.length === 0) {
       return new Response(JSON.stringify([]), { 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    const songListString = contextSongs
      .map((s: any) => `${s.name || 'Unknown'} - ${s.artist || 'Unknown'}`)
      .join(', ');

    const prompt = `Act as a professional music curator. Based on this user repertoire: [${songListString}], suggest 10 similar songs that would fit this artist's performance style. 
    Focus on variety within the same genres.
    Return ONLY a raw JSON array of objects. No markdown formatting, no backticks, no intro text.
    Format: [{"name": "Song Title", "artist": "Artist Name", "reason": "Brief reason why"}]`;

    let lastError = null;

    for (const apiKey of keys) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`[AI Engine] API Key Error (${response.status}):`, result.error?.message);
          lastError = result.error?.message || response.statusText;
          continue; 
        }

        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error("AI returned empty content");

        // Clean up response: find the first '[' and last ']' to extract pure JSON
        const startIndex = rawText.indexOf('[');
        const endIndex = rawText.lastIndexOf(']');
        
        if (startIndex === -1 || endIndex === -1) {
          console.error("[AI Engine] AI returned non-JSON text:", rawText);
          throw new Error("Invalid AI response format");
        }

        const jsonString = rawText.substring(startIndex, endIndex + 1);
        
        return new Response(jsonString, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        console.error("[AI Engine] Internal Key Attempt Failed:", err.message);
        lastError = err.message;
      }
    }

    throw new Error(`All API keys failed or timed out. Last error: ${lastError}`);

  } catch (error) {
    console.error("[Global Error] suggest-songs failure:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})