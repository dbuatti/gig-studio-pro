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

  const supabaseAdmin = createClient(
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { songIds } = await req.json();
    
    if (!songIds || !Array.isArray(songIds)) {
      throw new Error("Invalid song list provided.");
    }

    console.log(`[bulk-populate-youtube-links] Processing ${songIds.length} tracks with duration matching...`);

    const results = [];

    for (const id of songIds) {
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING' }).eq('id', id);

        // 1. Get Reference Duration from iTunes (Level 1 Accuracy)
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        const itunesData = await itunesRes.json();
        const topItunes = itunesData.results?.[0];
        const refDurationSec = topItunes ? Math.floor(topItunes.trackTimeMillis / 1000) : 0;

        // 2. Refined Search Query (Level 1: Strict as per notes)
        const searchArtist = topItunes?.artistName || song.artist;
        const searchTitle = topItunes?.trackName || song.title;
        const ytSearchQuery = `${searchArtist} - ${searchTitle} (Official Audio)`;

        const instance = 'https://iv.ggtyler.dev';
        const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytSearchQuery)}`);
        
        if (!ytRes.ok) throw new Error(`Search engine error: ${ytRes.status}`);
        
        const ytData = await ytRes.json();
        const videos = ytData?.filter?.((v: any) => v.type === "video") || [];

        let matchedVideo = null;

        // 3. Duration Matching Constraint (+/- 30s)
        if (refDurationSec > 0) {
          for (const v of videos) {
            const diff = Math.abs(v.durationSeconds - refDurationSec);
            if (diff <= 30) {
              matchedVideo = v;
              break;
            }
          }
        } else {
          matchedVideo = videos[0]; // Fallback to top hit if no ref duration
        }

        if (matchedVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${matchedVideo.videoId}`;
          
          await supabaseAdmin.from('repertoire').update({
            youtube_url: youtubeUrl,
            metadata_source: 'auto_populated',
            sync_status: 'COMPLETED',
            last_sync_log: `Auto-populated: ${matchedVideo.videoId} (Diff: ${refDurationSec ? Math.abs(matchedVideo.durationSeconds - refDurationSec) : 'N/A'}s)`
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: song.title, videoId: matchedVideo.videoId });
        } else {
          throw new Error("No YouTube match meeting duration constraints (+/- 30s) found.");
        }

      } catch (err: any) {
        console.error(`[bulk-populate-youtube-links] Error on track ${id}:`, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message });
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})