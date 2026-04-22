// MD Audit Edge Function
// Last Deploy: 2024-05-20T10:00:00Z
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Song {
  name: string;
  artist: string;
  bpm?: string;
  energy_level?: string;
  readiness: number;
  genre?: string;
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
    const { songs, setlistName } = await req.json() as { songs: Song[], setlistName: string };

    const providers = [
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY'), name: 'Pool #1' },
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2'), name: 'Pool #2' },
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3'), name: 'Pool #3' },
      // @ts-ignore: Deno global
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY'), name: 'OpenRouter' }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found in environment.');
    }

    const shuffledProviders = [...providers].sort(() => Math.random() - 0.5);

    const prompt = `You are a world-class Musical Director (MD) for high-end corporate events and weddings. 
Analyze the following setlist: "${setlistName}"

SONGS IN ORDER:
${songs.map((s, i) => `${i + 1}. ${s.name} (${s.artist}) | Energy: ${s.energy_level || 'TBC'} | BPM: ${s.bpm || '?'} | Readiness: ${s.readiness}%`).join('\n')}

PROVIDE A PROFESSIONAL AUDIT IN 3 CATEGORIES:
1. ENERGY FLOW: Is the energy curve logical? Are there "dead spots" or "burnout zones"?
2. VOCAL/PERFORMANCE FATIGUE: Are there too many high-intensity songs in a row?
3. TECHNICAL RISK: Which songs are "danger zones" due to low readiness?

Keep the tone professional, encouraging, and concise. Use bullet points.
Output format: JSON with keys "energy", "fatigue", "risk", and "summary".`;

    let lastError = null;

    for (const provider of shuffledProviders) {
      try {
        console.log(`[md-audit] Attempting audit via ${provider.type.toUpperCase()} (${provider.name})...`);
        let content = "";

        if (provider.type === 'google') {
          // @ts-ignore: Deno global
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                  responseMimeType: "application/json",
                  temperature: 0.7 
                }
              }),
            }
          );

          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "Google API error");
          content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          // @ts-ignore: Deno global
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
              temperature: 0.7
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "OpenRouter API error");
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          const cleanedContent = cleanJsonResponse(content);
          JSON.parse(cleanedContent);
          
          return new Response(cleanedContent, { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (err: any) {
        console.warn(`[md-audit] Provider ${provider.name} failed: ${err.message}`);
        lastError = err.message;
        continue;
      }
    }

    throw new Error(`All AI providers exhausted. Last error: ${lastError}`);

  } catch (error: any) {
    console.error("[md-audit] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});