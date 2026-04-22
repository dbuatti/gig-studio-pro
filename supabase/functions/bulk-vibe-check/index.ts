// Bulk Vibe Check Edge Function
// Last Deploy: 2024-05-20T10:00:00Z
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { songIds } = await req.json();
    if (!songIds || !Array.isArray(songIds)) throw new Error("Invalid song IDs.");

    // @ts-ignore: Deno global
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const providers = [
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY') },
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2') },
      // @ts-ignore: Deno global
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3') }
    ].filter(p => !!p.key);

    const results = [];
    for (const id of songIds) {
      try {
        const { data: song } = await supabaseAdmin.from('repertoire').select('*').eq('id', id).eq('user_id', user.id).single();
        if (!song) continue;

        const provider = providers[Math.floor(Math.random() * providers.length)];
        const prompt = `Analyze this song for energy level: "${song.title}" by "${song.artist}". BPM: ${song.bpm}. Return ONLY JSON: {"energy_level": "Ambient"|"Pulse"|"Groove"|"Peak", "refined_genre": "string"}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${provider.key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } })
        });

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          const parsed = JSON.parse(cleanJsonResponse(content));
          await supabaseAdmin.from('repertoire').update({
            energy_level: parsed.energy_level,
            genre: parsed.refined_genre || song.genre,
            updated_at: new Date().toISOString()
          }).eq('id', id);
          results.push({ id, status: 'SUCCESS' });
        }
      } catch (err) {
        results.push({ id, status: 'ERROR', msg: err.message });
      }
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})