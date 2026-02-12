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
    
    if (!title || !artist) {
      throw new Error("Missing title or artist for analysis.");
    }

    const providers = [
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY'), name: 'Google Primary' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2'), name: 'Google Secondary' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3'), name: 'Google Tertiary' },
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY'), name: 'OpenRouter' }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found in environment.');
    }

    const shuffledProviders = providers.sort(() => Math.random() - 0.5);
    let lastError = null;

    const prompt = `Analyze this song for a professional live performance setlist:
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

    Return ONLY a JSON object:
    {
      "energy_level": "Ambient" | "Pulse" | "Groove" | "Peak",
      "refined_genre": "string",
      "confidence": 0.0-1.0
    }`;

    for (const provider of shuffledProviders) {
      try {
        console.log(`[vibe-check] Attempting "${title}" via ${provider.name} [v2.5]`);
        
        let content = "";
        if (provider.type === 'google') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            })
          });
          const result = await response.json();
          if (!response.ok) {
            const msg = result.error?.message || "Google API error";
            if (msg.includes("quota") || msg.includes("429")) {
              console.warn(`[vibe-check] ${provider.name} throttled. Trying next...`);
              continue;
            }
            throw new Error(msg);
          }
          content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${provider.key}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://supabase.com",
              "X-Title": "Gig Studio"
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" }
            })
          });
          const result = await response.json();
          if (!response.ok) {
            const msg = result.error?.message || "OpenRouter error";
            if (msg.includes("credits") || msg.includes("429")) {
              console.warn(`[vibe-check] ${provider.name} unavailable. Trying next...`);
              continue;
            }
            throw new Error(msg);
          }
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          return new Response(content, { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (err: any) {
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error("All providers exhausted.");

  } catch (error: any) {
    console.error("[vibe-check] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})