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
    const { query } = await req.json();
    // @ts-ignore: Deno global
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      console.error("GEMINI_API_KEY missing");
      return new Response(JSON.stringify({ 
        originalKey: "TBC", 
        bpm: "???", 
        isFound: false,
        error: "AI Configuration Missing" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = `Act as a professional music librarian. For the song "${query}", return ONLY a JSON object with this exact structure:
    {
      "originalKey": "The standard key (e.g., C, F#m, Eb)",
      "bpm": 120,
      "genre": "The genre",
      "isFound": true
    }
    Return ONLY the JSON. No markdown formatting.`;

    // Upgraded to Gemini 2.5 Flash on the stable v1 endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(result, null, 2));
      throw new Error(result.error?.message || "AI Provider Error");
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty AI response");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid response format");
    
    const metadata = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ 
      originalKey: "TBC", 
      isFound: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})