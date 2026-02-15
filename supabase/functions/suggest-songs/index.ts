import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cleans AI response text to ensure it's valid JSON.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { repertoire, seedSong, ignored } = await req.json();

    const providers = [
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY'), name: 'Pool #1' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2'), name: 'Pool #2' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3'), name: 'Pool #3' },
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY'), name: 'OpenRouter' }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found in environment.');
    }

    const shuffledProviders = [...providers].sort(() => Math.random() - 0.5);

    const prompt = `You are a professional Musical Director for a high-end event band.
    
    ${seedSong ? `The user wants songs similar to: "${seedSong.name}" by ${seedSong.artist}.` : "The user wants songs that complement their existing repertoire."}
    
    CURRENT REPERTOIRE (Sample):
    ${repertoire.slice(0, 20).map((s: any) => `- ${s.name} (${s.artist}) [${s.genre || 'Unknown'}]`).join('\n')}
    
    TASK:
    Suggest 3-5 NEW songs that would be perfect additions to this library.
    
    CRITICAL RULES:
    1. DO NOT suggest songs already in the repertoire or the ignored list.
    2. IGNORED LIST: ${ignored?.map((s: any) => s.name).join(', ') || 'None'}
    3. FORMAT: You MUST return a valid JSON array of objects.
    4. Each object MUST have: "name", "artist", and "reason".
    
    OUTPUT FORMAT:
    [
      {
        "name": "Song Title",
        "artist": "Artist Name",
        "reason": "Brief explanation of why this fits the vibe."
      }
    ]`;

    let lastError = null;

    for (const provider of shuffledProviders) {
      try {
        console.log(`[suggest-songs] Attempting suggestions via ${provider.type.toUpperCase()} (${provider.name})...`);
        let content = "";

        if (provider.type === 'google') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.8
              }
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "Google API error");
          content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${provider.key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.8
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "OpenRouter API error");
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          const cleanedContent = cleanJsonResponse(content);
          const parsed = JSON.parse(cleanedContent);
          const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.songs || []);
          
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            return new Response(JSON.stringify(suggestions), { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
        }
      } catch (err: any) {
        console.warn(`[suggest-songs] Provider ${provider.name} failed: ${err.message}`);
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error("All AI providers failed");

  } catch (error: any) {
    console.error("[suggest-songs] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})