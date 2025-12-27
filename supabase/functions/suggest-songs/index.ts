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
    const { repertoire, seedSong } = await req.json();
    
    const keys = [
      (globalThis as any).Deno.env.get('GEMINI_API_KEY'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_2'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      console.error("[suggest-songs] Missing API Key configuration.");
      throw new Error("Missing API Key configuration.");
    }

    // Prepare a comprehensive list of titles to exclude
    const existingTitles = repertoire.map((s: any) => `${s.name || 'Unknown'} - ${s.artist || 'Unknown'}`);
    const songListString = existingTitles.join(', ');
    
    let prompt = "";
    if (seedSong) {
      prompt = `Act as a professional music curator. Based specifically on the vibe, genre, and era of the song "${seedSong.name}" by ${seedSong.artist}, suggest 10 similar tracks for a live set.
      
      CRITICAL: You MUST NOT suggest any of these songs which are ALREADY in the user's library: [${songListString}].
      
      Focus on tracks that would transition well from the seed song.
      Return ONLY a JSON array of objects: [{"name": "Song Title", "artist": "Artist Name", "reason": "Connection to ${seedSong.name}"}]. No markdown.`;
    } else {
      prompt = `Act as a professional music curator. Based on this existing repertoire: [${songListString}], suggest 10 similar songs that would fit this artist's style. 
      
      CRITICAL: You MUST NOT suggest any songs that are already in the library list provided above. Suggest entirely new tracks.
      
      Return ONLY a JSON array of objects: [{"name": "Song Title", "artist": "Artist Name", "reason": "Short reason why"}]. No markdown.`;
    }

    let lastError = null;

    for (const apiKey of keys) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
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
          console.warn(`[suggest-songs] Gemini API rate limit or server error (Status: ${response.status}): ${lastError}`);
          continue;
        }

        if (!response.ok) {
          lastError = result.error?.message || `Gemini API returned non-OK status: ${response.status}`;
          console.error(`[suggest-songs] Gemini API request failed: ${lastError}`, { result });
          throw new Error(lastError);
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
          lastError = "AI returned empty response.";
          console.error(`[suggest-songs] ${lastError}`, { result });
          throw new Error(lastError);
        }

        // Robust JSON extraction
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
          lastError = "Invalid format from AI: Expected JSON array.";
          console.error(`[suggest-songs] ${lastError}`, { text });
          throw new Error(lastError);
        }
        
        return new Response(jsonMatch[0], {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        lastError = err.message;
        console.error(`[suggest-songs] Error during Gemini API call: ${err.message}`);
      }
    }

    console.error(`[suggest-songs] Engine exhausted all keys. Final error: ${lastError}`);
    return new Response(JSON.stringify({ error: `Engine exhausted all keys. Final error: ${lastError}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[suggest-songs] Top-level error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})