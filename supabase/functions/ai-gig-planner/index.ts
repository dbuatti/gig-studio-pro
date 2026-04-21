import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  return cleaned.trim();
}

async function searchITunes(term: string) {
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
    const data = await response.json();
    return data.results[0] || null;
  } catch (err) {
    console.error("iTunes Search Error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { emailText, repertoire } = body as { emailText: string, repertoire: Song[] };

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
    
    const prompt = `You are an expert Gig Planner. Analyze this gig inquiry email and suggest a setlist.

EMAIL CONTENT:
"${emailText}"

USER REPERTOIRE:
${repertoire.map(s => `ID: ${s.id} | ${s.name} - ${s.artist} | Genre: ${s.genre || 'Unknown'} | Energy: ${s.energy_level || 'Unknown'}`).join('\n')}

TASK:
1. Extract Gig Details: Duration, Vibe, and Special Requests.
2. Suggest Songs from the User's Repertoire (Library Hits).
3. Suggest New Songs not in the library that fit the vibe (New Discoveries).

FORMAT: Return ONLY a raw JSON object:
{
  "gigDetails": {
    "duration": "e.g. 3 hours",
    "vibe": "e.g. Upbeat Piano Bar",
    "specialRequests": ["request 1", "request 2"]
  },
  "suggestedLibrarySongs": ["id1", "id2"],
  "suggestedExternalSongs": [
    { "name": "Song Name", "artist": "Artist Name" }
  ]
}`;

    let lastError = null;
    let aiResult = null;

    for (const provider of shuffledProviders) {
      try {
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
          const result = await response.json();
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
              temperature: 0.3
            })
          });
          const result = await response.json();
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          aiResult = JSON.parse(cleanJsonResponse(content));
          break;
        }
      } catch (err) {
        console.warn(`Provider ${provider.name} failed:`, err);
        lastError = err;
      }
    }

    if (!aiResult) throw lastError || new Error("AI failed to generate plan");

    // Enrich external suggestions with iTunes data
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

    return new Response(JSON.stringify({
      ...aiResult,
      suggestedExternalSongs: enrichedExternal
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});