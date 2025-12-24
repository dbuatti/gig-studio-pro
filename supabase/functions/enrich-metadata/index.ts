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
    const { queries, mode = 'metadata' } = await req.json();
    
    const keys = [
      (globalThis as any).Deno.env.get('GEMINI_API_KEY'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_2'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      throw new Error("No Gemini API keys configured in secrets.");
    }

    let prompt = "";
    if (mode === 'lyrics') {
      prompt = `Act as a professional stage manager. Format these lyrics with double newlines between verses and proper punctuation for stage reading. Return ONLY a JSON object: {"lyrics": "formatted_lyrics_here"}. Lyrics: ${queries[0]}`;
    } else {
      const songsList = Array.isArray(queries) ? queries : [queries];
      prompt = `Act as a professional music librarian. For these songs, return a JSON array of objects. Each object MUST include: {"name": "title", "artist": "primary artist", "originalKey": "standard key (C, F#m, etc)", "bpm": number, "genre": "genre", "youtubeUrl": "direct link to official music video or high quality audio on youtube", "isMetadataConfirmed": true}. 
      Songs: ${songsList.join('\n')}. 
      Return ONLY the JSON array. No markdown.`;
    }

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

        if (!response.ok) {
          throw new Error(result.error?.message || "API Error");
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        
        if (!jsonMatch) throw new Error("Invalid AI format: " + text);
        
        return new Response(jsonMatch[0], {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        lastError = err.message;
        console.error(`[AI Engine] Attempt failed: ${err.message}`);
      }
    }

    throw new Error(`All API keys exhausted. Last error: ${lastError}`);

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})