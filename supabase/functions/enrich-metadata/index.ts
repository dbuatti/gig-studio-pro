// @ts-ignore: Deno runtime import
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
    const { queries } = await req.json();
    // @ts-ignore: Deno global
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI Configuration Missing" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const songsList = Array.isArray(queries) ? queries : [queries];
    
    const prompt = `Act as a professional music librarian. For the following list of songs, return a JSON array of objects. 
    Each object must have: 
    {
      "name": "The original song title (clean version, e.g., 'Moon River')",
      "artist": "The primary artist or composer (e.g., 'Audrey Hepburn' or 'Henry Mancini')",
      "originalKey": "The standard key (e.g., C, F#m, Eb)",
      "bpm": 120,
      "genre": "The genre",
      "isFound": true
    }
    
    Songs to process:
    ${songsList.join('\n')}
    
    Return ONLY the JSON array. No markdown, no conversational text.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error?.message || "AI Provider Error");
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty AI response");

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Invalid response format");
    
    const metadata = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})