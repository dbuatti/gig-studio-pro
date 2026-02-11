import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

    console.log(`[ai-setlist-sorter] Analyzing ${songs.length} songs with instruction: "${instruction}"`);

    const prompt = `You are an expert DJ and setlist curator. 
I have a list of songs and I want you to reorder them based on my specific instructions.

USER INSTRUCTION: "${instruction}"

SONGS:
${songs.map((s, i) => `${i + 1}. ID: ${s.id} | Title: ${s.name} | Artist: ${s.artist} | BPM: ${s.bpm || 'Unknown'} | Genre: ${s.genre || 'Unknown'} | Energy: ${s.energy_level || 'Unknown'} | Duration: ${s.duration_seconds || 0}s`).join('\n')}

CRITICAL RULES:
1. Return ONLY a JSON array of the song IDs in the new order.
2. Include ALL song IDs provided in the input.
3. If the instruction specifies a duration (e.g., "2 hours"), prioritize the best songs for that duration at the beginning of the list, and place the remaining "outlier" songs at the end.
4. Use your deep musical knowledge of these songs (even if metadata is missing) to make the best judgment on energy, mood, and flow.
5. Do not include any explanation, markdown formatting, or other text. Just the raw JSON array.

Example Output Format:
["uuid-1", "uuid-2", "uuid-3"]`;

    // Use v1 API with gemini-2.5-flash model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("[ai-setlist-sorter] Gemini API error:", result);
      throw new Error(result.error?.message || 'Failed to call Gemini API');
    }

    const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiResponseText) {
      throw new Error('Empty response from AI');
    }

    console.log("[ai-setlist-sorter] Raw AI response:", aiResponseText);

    let orderedIds: string[];
    try {
      // Try direct JSON parse first
      orderedIds = JSON.parse(aiResponseText);
    } catch (e) {
      console.log("[ai-setlist-sorter] Direct parse failed, attempting regex extraction");
      // Fallback: extract JSON array using regex
      const match = aiResponseText.match(/\[[\s\S]*?\]/);
      if (match) {
        orderedIds = JSON.parse(match[0]);
      } else {
        console.error("[ai-setlist-sorter] Could not extract JSON array from:", aiResponseText);
        throw new Error('AI response was not a valid JSON array');
      }
    }

    // Validate that we got an array
    if (!Array.isArray(orderedIds)) {
      throw new Error('AI response was not an array');
    }

    // Ensure all original IDs are present (AI might miss some or add duplicates)
    const originalIds = songs.map(s => s.id);
    const validOrderedIds = orderedIds.filter(id => originalIds.includes(id));
    const missingIds = originalIds.filter(id => !validOrderedIds.includes(id));
    
    // Combine valid ordered IDs with any missing ones at the end
    const finalOrder = [...new Set([...validOrderedIds, ...missingIds])];

    console.log(`[ai-setlist-sorter] Successfully reordered ${finalOrder.length} songs`);

    return new Response(
      JSON.stringify({ orderedIds: finalOrder }),
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