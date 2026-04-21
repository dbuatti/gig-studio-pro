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
    const { queries, mode = 'metadata' } = await req.json();
    
    const providers = [
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY'), name: 'Pool #1' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2'), name: 'Pool #2' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3'), name: 'Pool #3' },
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY'), name: 'OpenRouter' }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error("No AI provider keys configured in secrets.");
    }

    const shuffledProviders = [...providers].sort(() => Math.random() - 0.5);

    let prompt = "";
    if (mode === 'lyrics') {
      prompt = `Act as a professional stage manager. Format these lyrics with double newlines between verses and proper punctuation for stage reading. Return ONLY a JSON object: {"lyrics": "formatted_lyrics_here"}. Lyrics: ${queries[0]}`;
    } else if (mode === 'chords-cleanup') {
      prompt = `Act as a professional music editor. Correct typos, fix common misspellings (like 'Bbriday' to 'Friday', 'Cetting' to 'Getting', 'Averything' to 'Everything'), and ensure proper formatting for the following chord/lyric block. Preserve the chord structure and line breaks. Return ONLY a JSON object: {"cleaned_text": "corrected_chord_text_here"}. Text: ${queries[0]}`;
    } else {
      const songsList = Array.isArray(queries) ? queries : [queries];
      prompt = `Act as a professional music librarian. For these songs, return a JSON array of objects. Each object MUST include: {"name": "title", "artist": "primary artist", "originalKey": "standard key (C, F#m, etc)", "bpm": number, "genre": "genre", "youtubeUrl": "direct link to official music video or high quality audio on youtube", "isMetadataConfirmed": true}. 
      Songs: ${songsList.join('\n')}. 
      Return ONLY the JSON array. No markdown.`;
    }

    let lastError = null;
    
    for (const provider of shuffledProviders) {
      try {
        console.log(`[enrich-metadata] Attempting ${mode} via ${provider.type.toUpperCase()} (${provider.name})...`);
        let content = "";

        if (provider.type === 'google') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.1
              }
            })
          });

          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error?.message || "Google API Error");
          }
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
              temperature: 0.1
            })
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error?.message || "OpenRouter API error");
          }
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          const cleanedContent = cleanJsonResponse(content);
          // Validate JSON
          JSON.parse(cleanedContent);
          
          return new Response(cleanedContent, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (err: any) {
        console.warn(`[enrich-metadata] Provider ${provider.name} failed: ${err.message}`);
        lastError = err.message;
        continue;
      }
    }

    throw new Error(`All API providers exhausted. Last error: ${lastError}`);

  } catch (error: any) {
    console.error("[enrich-metadata] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
