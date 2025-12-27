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
    const { songIds, overwrite = false } = await req.json();
    
    if (!songIds || !Array.isArray(songIds)) {
      throw new Error("Invalid song list provided.");
    }

    console.log(`[global-auto-sync] Processing ${songIds.length} tracks...`);

    const results = [];

    for (const id of songIds) {
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        if (song.metadata_source === 'itunes_autosync' && !overwrite) {
          results.push({ id, status: 'SKIPPED', msg: 'Already synced.' });
          continue;
        }

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING' }).eq('id', id);

        // 1. Metadata Enrichment (iTunes)
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        const itunesData = await itunesRes.json();
        const topResult = itunesData.results?.[0];

        let enrichedMetadata: any = {};
        let itunesDurationSec = 0;

        if (topResult) {
          itunesDurationSec = Math.floor(topResult.trackTimeMillis / 1000);
          enrichedMetadata = {
            title: topResult.trackName,
            artist: topResult.artistName,
            genre: topResult.primaryGenreName,
            apple_music_url: topResult.trackViewUrl,
            metadata_source: 'itunes_autosync',
            auto_synced: true
          };
          console.log(`[global-auto-sync] iTunes Ref: ${topResult.trackName} (${itunesDurationSec}s)`);
        }

        // 2. Refined Search Query (Level 1: Strict)
        const searchArtist = topResult?.artistName || song.artist;
        const searchTitle = topResult?.trackName || song.title;
        const ytSearchQuery = `${searchArtist} - ${searchTitle} (Official Audio)`;

        const instance = 'https://iv.ggtyler.dev';
        const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytSearchQuery)}`);
        const ytData = await ytRes.json();
        const videos = ytData?.filter?.((v: any) => v.type === "video") || [];

        let matchedVideo = null;

        // 3. Duration Matching (Constraint: +/- 30s)
        if (itunesDurationSec > 0) {
          for (const v of videos) {
            const diff = Math.abs(v.durationSeconds - itunesDurationSec);
            if (diff <= 30) {
              matchedVideo = v;
              console.log(`[global-auto-sync] Match Found: ${v.title} (Diff: ${diff}s)`);
              break;
            }
          }
        } else {
          matchedVideo = videos[0]; // Fallback to top hit if no duration to compare
        }

        if (matchedVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${matchedVideo.videoId}`;
          
          await supabaseAdmin.from('repertoire').update({
            ...enrichedMetadata,
            youtube_url: youtubeUrl,
            sync_status: 'COMPLETED',
            last_sync_log: `Matched: ${matchedVideo.title} (Duration OK)`
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: matchedVideo.title });
        } else {
          throw new Error("No YouTube match meeting duration constraints found.");
        }

      } catch (err) {
        console.error(`[global-auto-sync] Error on track ${id}:`, err.message);
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

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})