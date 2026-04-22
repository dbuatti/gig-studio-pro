// Global Auto Sync Edge Function
// Last Deploy: 2024-05-20T10:00:00Z
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { songIds, overwrite = false } = await req.json();
    if (!songIds || !Array.isArray(songIds)) throw new Error("Invalid song list.");

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const results = [];

    for (const id of songIds) {
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id) // Ownership check
          .single();

        if (fetchErr || !song) continue;

        if (song.metadata_source === 'itunes_autosync' && !overwrite) {
          results.push({ id, status: 'SKIPPED', msg: 'Already synced' });
          continue;
        }

        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        const itunesData = await itunesRes.json();
        const topResult = itunesData.results?.[0];

        if (topResult) {
          await supabaseAdmin.from('repertoire').update({
            title: topResult.trackName,
            artist: topResult.artistName,
            genre: topResult.primaryGenreName,
            apple_music_url: topResult.trackViewUrl,
            metadata_source: 'itunes_autosync',
            auto_synced: true,
            sync_status: 'COMPLETED'
          }).eq('id', id);
          results.push({ id, status: 'SUCCESS', title: topResult.trackName });
        }
      } catch (err) {}
      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})