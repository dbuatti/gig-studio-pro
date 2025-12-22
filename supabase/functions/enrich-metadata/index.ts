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

    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Supabase Secrets.");

    const prompt = `Act as a professional music librarian. For the song "${query}", return ONLY a JSON object with this exact structure:
    {
      "originalKey": "The standard key (e.g., C, F#m, Eb)",
      "bpm": "The numeric BPM",
      "genre": "The genre",
      "isFound": true
    }
    If you are unsure of the key, return your best estimate based on the most famous recording. Do not include markdown formatting or any text other than the JSON object.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Gemini API Error:", result);
      throw new Error(result.error?.message || "AI Provider Error");
    }

    let text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI returned an empty response.");

    // Strip any potential markdown wrappers the AI might have added
    text = text.replace(/```json|```/g, '').trim();
    const metadata = JSON.parse(text);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Metadata Function Failure:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})