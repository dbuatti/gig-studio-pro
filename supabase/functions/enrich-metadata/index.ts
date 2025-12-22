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

    // If key is missing, don't 500, just return isFound: false
    if (!apiKey) {
      console.error("CRITICAL: GEMINI_API_KEY is missing in Supabase Secrets.");
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
    If you are unsure of the key, return your best estimate. No markdown formatting.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

    let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI returned an empty response.");

    // Improved JSON extraction in case AI adds fluff
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");
    
    const metadata = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Metadata Logic Error:", error.message);
    return new Response(JSON.stringify({ 
      originalKey: "TBC", 
      isFound: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})