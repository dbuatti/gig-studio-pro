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
  'https://inv.vern.cc',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pro',
  'https://invidious.no-logs.com',
  'https://inv.zzls.xyz'
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

    // console.log("[bulk-populate-youtube-links] Starting discovery for batch:", songIds.length); // Removed verbose log

    const results = [];
    const EXCLUDED_KEYWORDS = ['cover', 'tutorial', 'karaoke', 'lesson', 'instrumental', 'remix', 'mashup'];

    for (const id of songIds) {
      // Basic UUID validation to prevent DB errors
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        // console.warn("[bulk-populate-youtube-links] Skipping invalid ID:", id); // Removed verbose log
        continue;
      }

      let lastSyncLog = '';
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING', last_sync_log: 'Discovery engine active...' }).eq('id', id);

        // 1. Get Reference Duration from iTunes
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        let refDurationSec = 0;
        try {
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            const topItunes = itunesData.results?.[0];
            refDurationSec = topItunes ? Math.floor(topItunes.trackTimeMillis / 1000) : 0;
          }
        } catch (e) {
          // console.error("[bulk-populate-youtube-links] iTunes fetch failed:", e); // Removed verbose log
        }

        // 2. Refined Multi-Pass Search
        const queries = [
          `${song.artist} - ${song.title} (Official Audio)`,
          `${song.artist} - ${song.title} (Official lyric)`,
          `${song.artist} - ${song.title}`
        ];

        let videos: any[] = [];
        let searchSuccess = false;

        for (const query of queries) {
          if (searchSuccess) break;
          
          for (const instance of INVIDIOUS_INSTANCES) {
            try {
              const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}`);
              if (ytRes.ok) {
                const data = await ytRes.json();
                const filtered = data?.filter?.((v: any) => v.type === "video") || [];
                if (filtered.length > 0) {
                  videos = filtered;
                  searchSuccess = true;
                  break;
                }
              }
            } catch (e) {}
          }
        }

        if (!searchSuccess) {
          throw new Error('No searchable records found across instances.');
        }

        const songTitleLower = song.title.toLowerCase();
        const findMatch = (tolerance: number | null) => {
          return videos.find(v => {
            const vTitleLower = v.title.toLowerCase();
            const containsForbidden = EXCLUDED_KEYWORDS.some(kw => 
              vTitleLower.includes(kw) && !songTitleLower.includes(kw)
            );
            if (containsForbidden) return false;

            if (tolerance !== null && refDurationSec > 0) {
              const diff = Math.abs(v.durationSeconds - refDurationSec);
              return diff <= tolerance;
            }
            return true;
          });
        };

        let matchedVideo = findMatch(20) || findMatch(60) || findMatch(null);

        if (matchedVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${matchedVideo.videoId}`;
          lastSyncLog = `Bound: ${matchedVideo.videoId}`;
          
          await supabaseAdmin.from('repertoire').update({
            youtube_url: youtubeUrl,
            metadata_source: 'auto_populated',
            sync_status: 'COMPLETED',
            last_sync_log: lastSyncLog
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: song.title, videoId: matchedVideo.videoId });
        } else {
          throw new Error("No criteria-matched YouTube records found.");
        }

      } catch (err: any) {
        console.error("[bulk-populate-youtube-links] Error processing song:", id, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message, song_id: id });
      }

      await new Promise(r => setTimeout(r, 800)); // Rate limit buffer
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: songIds.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[bulk-populate-youtube-links] Fatal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})