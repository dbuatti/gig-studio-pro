import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Song {
  id: string;
  name: string;
  artist: string;
  bpm?: string;
  genre?: string;
  energy_level?: string;
  duration_seconds?: number;
  readiness?: number;
  isLocked?: boolean;
  lockedPosition?: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    const { songs, instruction } = body as { songs: Song[], instruction: string };

    // Define the provider pool
    const providers = [
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY') },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2') },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3') },
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY') }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found in environment.');
    }

    // Pick a random provider
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const providerIndex = providers.indexOf(provider) + 1;

    console.log(`[ai-setlist-sorter] Sorting via ${provider.type.toUpperCase()} (Pool #${providerIndex}) [v2.3]`, { count: songs?.length, instruction });

    const prompt = `You are an expert Musical Director. Reorder these songs based on this instruction: "${instruction}"

CRITICAL RULES:
1. GENRE FLOW: Ensure a logical musical progression.
2. CONSTRAINTS: If a song is "LOCKED", it MUST stay at its 'lockedPosition'.
3. OMIT songs only if the instruction explicitly implies a filter.

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | Energy: ${s.energy_level || 'Unknown'} | ${s.isLocked ? `LOCKED AT ${s.lockedPosition}` : 'UNLOCKED'}`).join('\n')}

Return ONLY a JSON object with an array of IDs in the new order:
{
  "orderedIds": ["id1", "id2", "id3"]
}`;

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
      if (!response.ok) throw new Error(result.error?.message || "Google API error");
      content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      // OpenRouter implementation
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
      if (!response.ok) throw new Error(result.error?.message || "OpenRouter API error");
      content = result.choices?.[0]?.message?.content;
    }

    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    
    if (parsed.orderedIds && Array.isArray(parsed.orderedIds)) {
      return new Response(JSON.stringify({ orderedIds: parsed.orderedIds }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    throw new Error("Invalid AI response format");

  } catch (error: any) {
    console.error("[ai-setlist-sorter] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});