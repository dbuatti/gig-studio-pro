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
    const { title, artist, bpm, genre, userTags } = await req.json();
    
    const keys = [
      (globalThis as any).Deno.env.get('GEMINI_API_KEY'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_2'),
      (globalThis as any).Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      console.error("[vibe-check] Missing API Key configuration.");
      throw new Error("Missing API Key configuration.");
    }

    const prompt = `Act as a professional music curator and setlist sequencing expert. Your task is to assign a single 'Energy Zone' to the song based on its BPM, genre, and cultural impact.

CRITICAL INSTRUCTIONS:
1. Analyze the song: "${title}" by ${artist}.
2. Consider its BPM (${bpm}), Genre (${genre}), and User Tags (${userTags.join(', ')}).
3. Assign one of the following four Energy Zones: 'Ambient', 'Pulse', 'Groove', or 'Peak'.
4. Use the following criteria:
   - Ambient: Background/Dinner music. Typically < 80 BPM, Acoustic/Ballad.
   - Pulse: Foot-tappers, mid-tempo swaying. Typically 80–110 BPM, Soft Rock/Jazz.
   - Groove: Filling the floor, sing-alongs. Typically 110–128 BPM, Disco/Pop.
   - Peak: High-octane finishers, "The Riot." Typically 128+ BPM or high cultural energy anthems (e.g., 'Mr. Brightside').
5. Return ONLY a JSON object: {"energy_level": "Zone"}. Do not include any other text or markdown.

Example Output: {"energy_level": "Groove"}`;

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
          console.warn(`[vibe-check] Gemini API rate limit or server error (Status: ${response.status}): ${lastError}`);
          continue;
        }

        if (!response.ok) {
          lastError = result.error?.message || `Gemini API returned non-OK status: ${response.status}`;
          throw new Error(lastError);
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("AI returned empty response.");

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid format from AI.");
        
        return new Response(jsonMatch[0], {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        lastError = err.message;
      }
    }

    return new Response(JSON.stringify({ error: `Engine exhausted all keys. Final error: ${lastError}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})