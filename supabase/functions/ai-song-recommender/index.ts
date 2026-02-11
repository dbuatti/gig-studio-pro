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
  readiness: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { currentSetlist, repertoire, instruction } = await req.json() as { 
      currentSetlist: Song[], 
      repertoire: Song[],
      instruction?: string 
    };

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('API key not configured');

    // Filter out songs already in the setlist
    const currentIds = new Set(currentSetlist.map(s => s.id));
    const candidates = repertoire.filter(s => !currentIds.has(s.id));

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), { headers: corsHeaders });
    }

    const prompt = `You are a world-class Musical Director. 
CURRENT SETLIST:
${currentSetlist.map((s, i) => `${i + 1}. ${s.name} (${s.artist}) | Energy: ${s.energy_level} | BPM: ${s.bpm}`).join('\n')}

AVAILABLE REPERTOIRE CANDIDATES:
${candidates.map((s) => `ID: ${s.id} | ${s.name} (${s.artist}) | Energy: ${s.energy_level} | BPM: ${s.bpm} | Readiness: ${s.readiness}% | Genre: ${s.genre}`).join('\n')}

USER INSTRUCTION: "${instruction || 'Suggest 3 songs that would improve the flow and energy of this set.'}"

TASK:
Pick the 3 BEST songs from the candidates that would work well in this set.
Consider:
1. Energy Flow: Does the set need a high-energy peak or a soft ambient break?
2. Technical Readiness: Prioritize songs with >70% readiness.
3. Genre/Vibe: Maintain or intentionally shift the vibe.

OUTPUT:
Return ONLY a JSON array of objects with "id" and "reason" (a short 1-sentence explanation why it fits).
Example: [{"id": "uuid", "reason": "Perfect high-energy transition after the mid-set ballad."}]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, response_mime_type: "application/json" }
        }),
      }
    );

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    return new Response(text, { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});