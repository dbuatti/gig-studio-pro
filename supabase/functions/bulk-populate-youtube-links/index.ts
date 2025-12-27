// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INVIDIOUS_INSTANCES = [
  'https://iv.ggtyler.dev',
  'https://yewtu.be',
  'https://invidious.flokinet.to',
  'https://inv.vern.cc'
];

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

    console.log(`[bulk-populate-youtube-links] Processing ${songIds.length} tracks...`);

    const results = [];
    const EXCLUDED_KEYWORDS = ['live', 'cover', 'remix', 'tutorial', 'karaoke', 'instrumental'];

    for (const id of songIds) {
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING' }).eq('id', id);

        // 1. Get Reference Duration from iTunes
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        const itunesData = await itunesRes.json();
        const topItunes = itunesData.results?.[0];
        const refDurationSec = topItunes ? Math.floor(topItunes.trackTimeMillis / 1000) : 0;

        // 2. Refined Search Query
        const searchArtist = topItunes?.artistName || song.artist;
        const searchTitle = topItunes?.trackName || song.title;
        const ytSearchQuery = `${searchArtist} - ${searchTitle}`;

        let videos: any[] = [];
        let searchSuccess = false;

        // Try multiple instances if one fails
        for (const instance of INVIDIOUS_INSTANCES) {
          try {
            console.log(`[bulk-populate-youtube-links] Trying instance: ${instance}`);
            const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytSearchQuery + ' (Official Audio)')}`);
            if (ytRes.ok) {
              const data = await ytRes.json();
              videos = data?.filter?.((v: any) => v.type === "video") || [];
              if (videos.length > 0) {
                searchSuccess = true;
                break;
              }
            }
          } catch (e) {
            console.warn(`[bulk-populate-youtube-links] Instance ${instance} failed, moving to next...`);
          }
        }

        // Looser search if strict failed
        if (!searchSuccess) {
          for (const instance of INVIDIOUS_INSTANCES) {
            try {
              const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytSearchQuery)}`);
              if (ytRes.ok) {
                const data = await ytRes.json();
                videos = data?.filter?.((v: any) => v.type === "video") || [];
                if (videos.length > 0) {
                  searchSuccess = true;
                  break;
                }
              }
            } catch (e) {}
          }
        }

        let matchedVideo = null;
        const songTitleLower = song.title.toLowerCase();

        // 3. Match Logic (Relaxed to 30s)
        for (const v of videos) {
          const vTitleLower = v.title.toLowerCase();
          
          const containsForbidden = EXCLUDED_KEYWORDS.some(kw => 
            vTitleLower.includes(kw) && !songTitleLower.includes(kw)
          );
          
          if (containsForbidden) continue;

          if (refDurationSec > 0) {
            const diff = Math.abs(v.durationSeconds - refDurationSec);
            // Relaxed to 30s to account for video intros/outros
            if (diff <= 30) {
              matchedVideo = v;
              break;
            }
          } else {
            matchedVideo = v;
            break;
          }
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
          throw new Error("No high-confidence match found within duration constraints.");
        }

      } catch (err: any) {
        console.error(`[bulk-populate-youtube-links] Error on track ${id}:`, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message, song_id: id });
      }

      await new Promise(r => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: songIds.length,
      successful: results.filter(r => r.status === 'SUCCESS').length,
      failed: results.filter(r => r.status === 'ERROR').length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})