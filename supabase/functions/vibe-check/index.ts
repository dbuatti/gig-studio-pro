import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { title, artist, bpm, genre, userTags } = await req.json();
    
    if (!title || !artist) {
      throw new Error("Missing title or artist for analysis.");
    }

    // Added [v2.1] to help you confirm the new code is running
    console.log(`[vibe-check] Analyzing: "${title}" by ${artist} via Native Gemini 2.0 Flash [v2.1]`);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment.');
    }

    const prompt = `Analyze this song for a professional live performance setlist:
    Title: "${title}"
    Artist: "${artist}"
    BPM: ${bpm || 'Unknown'}
    Genre: ${genre || 'Unknown'}
    Tags: ${userTags?.join(', ') || 'None'}

    Classify this song into exactly ONE of these Energy Zones:
    1. Ambient: Background, soft, low intensity (e.g., dinner music, ballads).
    2. Pulse: Mid-tempo, engaging, steady rhythm (e.g., light pop, soft rock).
    3. Groove: High movement, danceable, strong rhythm (e.g., funk, upbeat pop).
    4. Peak: Maximum intensity, anthems, high energy (e.g., rock closers, dance floor fillers).

    Also suggest a refined Genre if the current one is "Unknown" or too broad.

    Return ONLY a JSON object:
    {
      "energy_level": "Ambient" | "Pulse" | "Groove" | "Peak",
      "refined_genre": "string",
      "confidence": 0.0-1.0
    }`;

    // Using gemini-2.0-flash on v1beta
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error(`[vibe-check] Gemini API failed:`, result.error || 'Unknown error');
      throw new Error(result.error?.message || "Gemini API error");
    }

    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("No content returned from AI");

    return new Response(content, { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[vibe-check] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})