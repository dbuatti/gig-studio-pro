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

    console.log("[ai-setlist-sorter] Sorting via Qwen 3 Next", { count: songs?.length, instruction });

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not found in environment.');
    }

    const prompt = `You are an expert Musical Director. Reorder these songs based on: "${instruction}"

CRITICAL RULES:
1. GENRE FLOW: Start with lower energy (Ambient/Pulse), build to Peak.
2. CONSTRAINTS: If a song is "LOCKED", it MUST stay at its 'lockedPosition'.
3. OMIT songs if the instruction implies a filter.

SONG DATA:
${songs.map((s) => `ID: ${s.id} | ${s.name} - ${s.artist} | Energy: ${s.energy_level || 'Unknown'} | ${s.isLocked ? `LOCKED AT ${s.lockedPosition}` : 'UNLOCKED'}`).join('\n')}

Return ONLY a JSON array of IDs in the new order.
Example: ["id1", "id2", "id3"]`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen/qwen3-next-80b-a3b-instruct:free",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "OpenRouter error");

    const text = result.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response from AI");

    // Extract array from response
    const match = text.match(/\[[\s\S]*?\]/);
    const orderedIds = JSON.parse(match ? match[0] : text);
    
    if (Array.isArray(orderedIds)) {
      return new Response(JSON.stringify({ orderedIds }), { 
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