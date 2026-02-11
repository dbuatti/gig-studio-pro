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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { songs, instruction } = await req.json() as { songs: Song[], instruction: string };

    if (!songs || !instruction) {
      return new Response(
        JSON.stringify({ error: 'Missing songs or instruction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[ai-setlist-sorter] Processing ${songs.length} songs: "${instruction}"`);

    // Optimized prompt for faster processing
    const prompt = `You are a professional setlist curator. Reorder these songs based on: "${instruction}"

SONGS (${songs.length} total):
${songs.map((s, i) => `${i + 1}. ${s.id}|${s.name}|${s.artist}|${s.bpm || '?'}BPM|${s.genre || '?'}|${s.energy_level || '?'}|${s.duration_seconds || 0}s`).join('\n')}

RULES:
1. Return ONLY a JSON array of song IDs in the new order
2. Include ALL ${songs.length} song IDs
3. For time-based requests (e.g., "2 hours"), prioritize best songs first, then add remaining songs
4. Consider energy flow, genre transitions, and audience engagement
5. NO explanations, NO markdown - just the JSON array

Output format: ["id1","id2","id3"]`;

    console.log(`[ai-setlist-sorter] Calling Gemini API...`);
    const startTime = Date.now();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    });

    const apiTime = Date.now() - startTime;
    console.log(`[ai-setlist-sorter] API responded in ${apiTime}ms`);

    const result = await response.json();
    
    if (!response.ok) {
      console.error("[ai-setlist-sorter] API error:", result);
      throw new Error(result.error?.message || 'Gemini API failed');
    }

    const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiResponseText) {
      throw new Error('Empty AI response');
    }

    console.log("[ai-setlist-sorter] Parsing AI response...");

    let orderedIds: string[];
    try {
      orderedIds = JSON.parse(aiResponseText);
    } catch (e) {
      const match = aiResponseText.match(/\[[\s\S]*?\]/);
      if (match) {
        orderedIds = JSON.parse(match[0]);
      } else {
        console.error("[ai-setlist-sorter] Parse failed. Response:", aiResponseText.substring(0, 500));
        throw new Error('Invalid AI response format');
      }
    }

    if (!Array.isArray(orderedIds)) {
      throw new Error('AI response was not an array');
    }

    // Validate and fix the order
    const originalIds = songs.map(s => s.id);
    const validOrderedIds = orderedIds.filter(id => originalIds.includes(id));
    const missingIds = originalIds.filter(id => !validOrderedIds.includes(id));
    const finalOrder = [...new Set([...validOrderedIds, ...missingIds])];

    const totalTime = Date.now() - startTime;
    console.log(`[ai-setlist-sorter] ✓ Sorted ${finalOrder.length} songs in ${totalTime}ms`);

    return new Response(
      JSON.stringify({ 
        orderedIds: finalOrder,
        processingTime: totalTime,
        songsProcessed: finalOrder.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[ai-setlist-sorter] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})