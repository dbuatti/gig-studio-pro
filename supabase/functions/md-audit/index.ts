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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { songs, setlistName } = await req.json() as { songs: Song[], setlistName: string };

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('API key not configured');

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