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
      console.error("[ai-setlist-sorter] Missing required fields");
      return new Response(
        JSON.stringify({ error: 'Missing songs or instruction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const keys = [
      Deno.env.get('GEMINI_API_KEY'),
      Deno.env.get('GEMINI_API_KEY_2'),
      Deno.env.get('GEMINI_API_KEY_3')
    ].filter(Boolean);

    if (keys.length === 0) {
      console.error("[ai-setlist-sorter] No API keys configured");
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[ai-setlist-sorter] Starting sort for ${songs.length} songs`);
    console.log(`[ai-setlist-sorter] Instruction: "${instruction}"`);

    // Ultra-optimized prompt for speed
    const prompt = `Reorder these ${songs.length} songs based on: "${instruction}"

SONGS:
${songs.map((s, i) => `${i + 1}. ID:${s.id}|${s.name}|${s.artist}|${s.bpm || '?'}BPM|${s.energy_level || '?'}`).join('\n')}

Return ONLY a JSON array of IDs in new order. Include ALL ${songs.length} IDs.
Format: ["id1","id2","id3",...]`;

    console.log(`[ai-setlist-sorter] Prompt length: ${prompt.length} chars`);
    const startTime = Date.now();

    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      console.log(`[ai-setlist-sorter] Trying API key ${i + 1}/${keys.length}...`);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
              }
            }),
          }
        );

        const apiTime = Date.now() - startTime;
        console.log(`[ai-setlist-sorter] API responded in ${apiTime}ms (Status: ${response.status})`);

        const result = await response.json();
        
        // Handle rate limits - try next key
        if (response.status === 429 || response.status >= 500) {
          lastError = result.error?.message || response.statusText;
          console.warn(`[ai-setlist-sorter] Rate limit/server error on key ${i + 1}: ${lastError}`);
          continue;
        }

        if (!response.ok) {
          lastError = result.error?.message || `API error: ${response.status}`;
          console.error(`[ai-setlist-sorter] API error on key ${i + 1}:`, result);
          throw new Error(lastError);
        }

        const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiResponseText) {
          throw new Error('Empty AI response');
        }

        console.log(`[ai-setlist-sorter] Parsing AI response (${aiResponseText.length} chars)...`);

        let orderedIds: string[];
        try {
          // Try direct parse first
          orderedIds = JSON.parse(aiResponseText);
        } catch (e) {
          // Fallback: extract JSON array from response
          const match = aiResponseText.match(/\[[\s\S]*?\]/);
          if (match) {
            orderedIds = JSON.parse(match[0]);
          } else {
            console.error("[ai-setlist-sorter] Parse failed. Response preview:", aiResponseText.substring(0, 200));
            throw new Error('Invalid AI response format - no JSON array found');
          }
        }

        if (!Array.isArray(orderedIds)) {
          throw new Error('AI response was not an array');
        }

        console.log(`[ai-setlist-sorter] Parsed ${orderedIds.length} IDs from AI`);

        // Validate and fix the order
        const originalIds = songs.map(s => s.id);
        const validOrderedIds = orderedIds.filter(id => originalIds.includes(id));
        const missingIds = originalIds.filter(id => !validOrderedIds.includes(id));
        
        if (missingIds.length > 0) {
          console.warn(`[ai-setlist-sorter] AI missed ${missingIds.length} songs - appending to end`);
        }
        
        const finalOrder = [...new Set([...validOrderedIds, ...missingIds])];

        const totalTime = Date.now() - startTime;
        console.log(`[ai-setlist-sorter] ✓ SUCCESS: Sorted ${finalOrder.length}/${songs.length} songs in ${totalTime}ms`);

        return new Response(
          JSON.stringify({ 
            orderedIds: finalOrder,
            processingTime: totalTime,
            songsProcessed: finalOrder.length,
            songsMissed: missingIds.length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } catch (err: any) {
        lastError = err.message;
        console.error(`[ai-setlist-sorter] Error with key ${i + 1}:`, err.message);
      }
    }

    // All keys exhausted
    console.error(`[ai-setlist-sorter] All ${keys.length} API keys failed. Last error: ${lastError}`);
    return new Response(
      JSON.stringify({ error: `All API keys exhausted. Last error: ${lastError}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[ai-setlist-sorter] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})