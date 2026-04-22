// AI Gig Planner Edge Function
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Song {
  id: string;
  name: string;
  artist: string;
  genre?: string;
  energy_level?: string;
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  return cleaned.trim();
}

async function searchITunes(term: string) {
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.results[0] || null;
  } catch (err) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { emailText, repertoire } = body as { emailText: string, repertoire: Song[] };

    if (!emailText) throw new Error("Missing emailText");

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
      return new Response(JSON.stringify({ error: "No AI API keys configured. Please check your Supabase Secrets." }), { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const shuffledProviders = [...providers].sort(() => Math.random() - 0.5);
    const prompt = `You are an expert Gig Planner. Analyze this email and suggest a setlist.\n\nEMAIL:\n"${emailText}"\n\nREPERTOIRE:\n${repertoire.map(s => `${s.name} - ${s.artist}`).join('\n')}\n\nReturn ONLY JSON: {"gigDetails": {"duration": "string", "vibe": "string", "specialRequests": []}, "suggestedLibrarySongs": [], "suggestedExternalSongs": [{"name": "", "artist": ""}]}`;

    let aiResult = null;
    let isQuotaError = false;

    for (const provider of shuffledProviders) {
      try {
        console.log(`[ai-gig-planner] Trying ${provider.name}...`);
        let content = "";
        if (provider.type === 'google') {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.3 }
            })
          });
          
          if (response.status === 429) {
            isQuotaError = true;
            throw new Error("Quota exceeded");
          }
          
          const result = await response.json();
          content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${provider.key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.3
            })
          });

          if (response.status === 402) throw new Error("Insufficient credits");
          const result = await response.json();
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          aiResult = JSON.parse(cleanJsonResponse(content));
          break;
        }
      } catch (err) {
        console.warn(`[ai-gig-planner] ${provider.name} failed: ${err.message}`);
      }
    }

    if (!aiResult) {
      const msg = isQuotaError 
        ? "AI Quota Exceeded. Please wait a few minutes or add a new Gemini API key to your secrets." 
        : "AI services are currently unavailable. Please check your API credits or try again later.";
      
      return new Response(JSON.stringify({ error: msg }), { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const enrichedExternal = await Promise.all(
      (aiResult.suggestedExternalSongs || []).map(async (s: any) => {
        const itunesData = await searchITunes(`${s.name} ${s.artist}`);
        if (itunesData) {
          return {
            name: itunesData.trackName,
            artist: itunesData.artistName,
            previewUrl: itunesData.previewUrl,
            artworkUrl: itunesData.artworkUrl100,
            genre: itunesData.primaryGenreName,
            duration_seconds: Math.floor(itunesData.trackTimeMillis / 1000),
            appleMusicUrl: itunesData.trackViewUrl
          };
        }
        return { ...s, isManual: true };
      })
    );

    return new Response(JSON.stringify({ ...aiResult, suggestedExternalSongs: enrichedExternal }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});