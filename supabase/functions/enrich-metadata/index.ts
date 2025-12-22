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
    const { queries, mode = 'metadata' } = await req.json();
    console.log(`Processing ${mode} request for:`, queries);
    
    // @ts-ignore: Deno global
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured in Edge Function environment");
      return new Response(JSON.stringify({ error: "AI Configuration Missing" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let prompt = "";
    
    if (mode === 'lyrics') {
      const lyricsText = queries[0];
      prompt = `Act as a professional stage manager and music director. 
      The following lyrics were pasted from a source that stripped verse breaks. 
      Please return ONLY the JSON object: {"lyrics": "The lyrics formatted with double newlines between verses and proper punctuation for easy reading on stage"}.
      
      Lyrics to format:
      ${lyricsText}`;
    } else {
      const songsList = Array.isArray(queries) ? queries : [queries];
      prompt = `Act as a professional music librarian. For the following list of songs, return a JSON array of objects. 
      
      Each object must have: 
      {
        "name": "The original song title",
        "artist": "The primary artist",
        "originalKey": "The standard key (e.g., C, F#m, Eb)",
        "bpm": 120,
        "genre": "The specific genre",
        "ugUrl": "The most likely official Ultimate Guitar URL",
        "isMetadataConfirmed": true
      }
      
      Songs to process:
      ${songsList.join('\n')}
      
      Return ONLY the JSON array.`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("Gemini API Error Response:", result);
      throw new Error(result.error?.message || "AI Provider Error");
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("Gemini API returned empty candidates:", result);
      throw new Error("Empty AI response");
    }

    console.log("Raw AI Response Text:", text);

    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Failed to find JSON in AI response:", text);
      throw new Error("Invalid response format");
    }
    
    const output = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Edge Function Error:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})