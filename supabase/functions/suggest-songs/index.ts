// Suggest Songs Edge Function
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cleans AI response text to ensure it's valid JSON.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { repertoire, seedSong, ignored } = await req.json();

    const providers = [
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY'), name: 'Pool #1' },
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2'), name: 'Pool #2' },
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3'), name: 'Pool #3' },
      // @ts-ignore: Deno global
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY'), name: 'OpenRouter' }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found in environment.');
    }

    const shuffledProviders = [...providers].sort(() => Math.random() - 0.5);

    // Limit context to 50 songs to prevent token quota issues
    const contextRepertoire = repertoire.slice(0, 50);

    // Analyze energy and genre profile of the subset
    const energyProfile = contextRepertoire.reduce((acc: Record<string, number>, s: any) => {
      const energy = s.energy_level || 'Unknown';
      acc[energy] = (acc[energy] || 0) + 1;
      return acc;
    }, {});
    const dominantEnergy = Object.entries(energyProfile).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]?.[0] || 'Mixed';

    const genreProfile = contextRepertoire.reduce((acc: Record<string, number>, s: any) => {
      const genre = s.genre || 'Unknown';
      if (genre !== 'Unknown') acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    const topGenres = Object.entries(genreProfile).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).slice(0, 3).map(([g]) => g).join(', ') || 'Mixed';

    const subsetName = (req as any).subsetName || 'General';

    const prompt = `You are a professional Musical Director for a high-end event band.

    ${seedSong ? `The user wants songs similar to: "${seedSong.name}" by ${seedSong.artist}.` : `The user wants songs for their set: "${subsetName}".`}

    CURRENT SET VIBE PROFILE:
    - Dominant Energy: ${dominantEnergy}
    - Top Genres: ${topGenres}
    - Total Songs in Set: ${contextRepertoire.length}

    CURRENT SET SONGS (DO NOT SUGGEST THESE):
    ${contextRepertoire.map((s: any) => `- ${s.name} (${s.artist}) [${s.energy_level || 'Unknown'} | ${s.genre || 'Unknown'}]`).join('\n')}

    TASK:
    Suggest 8-10 NEW songs that perfectly match the "${subsetName}" set vibe.
    The songs should match the dominant energy level "${dominantEnergy}" and genres like ${topGenres}.
    Focus on high-quality "pro" repertoire that event bands actually play.

    CRITICAL RULES:
    1. DO NOT suggest songs already in the set list above.
    2. IGNORED LIST (ALSO DO NOT SUGGEST): ${ignored?.map((s: any) => s.name).join(', ') || 'None'}
    3. FORMAT: You MUST return a valid JSON array of objects.
    4. Each object MUST have: "name", "artist", "reason", and "energy_level".
    5. Energy level must be one of: Ambient, Pulse, Groove, Peak.

    OUTPUT FORMAT:
    [
      {
        "name": "Song Title",
        "artist": "Artist Name",
        "reason": "Brief explanation of why this fits the ${subsetName} vibe.",
        "energy_level": "Ambient"
      }
    ]`;

    let lastError = null;
    let isQuotaError = false;

    for (const provider of shuffledProviders) {
      try {
        console.log(`[suggest-songs] Attempting suggestions via ${provider.type.toUpperCase()} (${provider.name})...`);
        let content = "";

        if (provider.type === 'google') {
          // @ts-ignore: Deno global
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${provider.key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.8
              }
            })
          });
          
          if (response.status === 429) {
            isQuotaError = true;
            throw new Error("Quota exceeded");
          }
          
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "Google API error");
          content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          // @ts-ignore: Deno global
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${provider.key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.8
            })
          });
          
          if (response.status === 429 || response.status === 402) {
            throw new Error("Provider quota or credit issue");
          }
          
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "OpenRouter API error");
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          const cleanedContent = cleanJsonResponse(content);
          const parsed = JSON.parse(cleanedContent);
          const suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.songs || []);
          
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            return new Response(JSON.stringify(suggestions), { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
        }
      } catch (err: any) {
        console.warn(`[suggest-songs] Provider ${provider.name} failed: ${err.message}`);
        lastError = err;
        continue;
      }
    }

    const errorMsg = isQuotaError ? "AI Quota Exceeded. Please try again in a few minutes." : (lastError?.message || "All AI providers failed");
    return new Response(JSON.stringify({ error: errorMsg, isQuotaError }), {
      status: isQuotaError ? 429 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[suggest-songs] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})