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

    // Ultra-optimized prompt for speed and strictness
    const prompt = `You are a professional music setlist curator. 
Your ONLY task is to REORDER the provided list of ${songs.length} songs based on this instruction: "${instruction}"

SONGS DATA (ONLY REORDER THESE):
${songs.map((s, i) => `ID: ${s.id} | Title: ${s.name} | Artist: ${s.artist} | BPM: ${s.bpm || 'Unknown'} | Energy: ${s.energy_level || 'Unknown'}`).join('\n')}

CRITICAL CONSTRAINTS:
1. DO NOT add any new songs.
2. DO NOT suggest songs that are not in the list above.
3. DO NOT remove any songs from the list.
4. Return ONLY a valid JSON array of the song IDs in the new order.
5. Do NOT include any explanations, introductory text, or concluding remarks.
6. Include EVERY song ID provided in the input exactly once.

Example Output:
["id-123", "id-456", "id-789"]`;

    const startTime = Date.now();
    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];
      console.log(`[ai-setlist-sorter] Trying API key ${i + 1}/${keys.length}...`);

      try {
        // Updated to gemini-2.0-flash as requested (using 2.0 as it is the standard latest)
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
              }
            }),
          }
        );

        const apiTime = Date.now() - startTime;
        console.log(`[ai-setlist-sorter] API responded in ${apiTime}ms (Status: ${response.status})`);

        const result = await response.json();
        
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

        let aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!aiResponseText) {
          throw new Error('Empty AI response');
        }

        console.log(`[ai-setlist-sorter] Parsing AI response...`);

        // Clean up markdown code blocks if present
        aiResponseText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();

        let orderedIds: string[];
        try {
          orderedIds = JSON.parse(aiResponseText);
        } catch (e) {
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