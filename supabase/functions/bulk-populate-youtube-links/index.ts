// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Expanded list of reliable Invidious instances
const INVIDIOUS_INSTANCES = [
  'https://iv.ggtyler.dev',
  'https://yewtu.be',
  'https://invidious.flokinet.to',
  'https://inv.vern.cc',
  'https://invidious.nerdvpn.de',
  'https://inv.tux.pro'
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
    const EXCLUDED_KEYWORDS = ['live', 'cover', 'remix', 'tutorial', 'karaoke', 'instrumental', 'lesson'];

    for (const id of songIds) {
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING' }).eq('id', id);

        // 1. Get Reference Duration from iTunes (High Precision Metadata)
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        const itunesData = await itunesRes.json();
        const topItunes = itunesData.results?.[0];
        const refDurationSec = topItunes ? Math.floor(topItunes.trackTimeMillis / 1000) : 0;

        // 2. Refined Multi-Pass Search
        const searchArtist = topItunes?.artistName || song.artist;
        const searchTitle = topItunes?.trackName || song.title;
        
        // Pass 1: Strict Audio Search
        const queries = [
          `${searchArtist} - ${searchTitle} (Official Audio)`,
          `${searchArtist} - ${searchTitle}`
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
            } catch (e) {
              console.warn(`[bulk-populate-youtube-links] Instance ${instance} failed for query ${query}`);
            }
          }
        }

        let matchedVideo = null;
        const songTitleLower = song.title.toLowerCase();

        // 3. Robust Match Logic (Tiered Duration Matching)
        const findMatch = (tolerance: number) => {
          return videos.find(v => {
            const vTitleLower = v.title.toLowerCase();
            const containsForbidden = EXCLUDED_KEYWORDS.some(kw => 
              vTitleLower.includes(kw) && !songTitleLower.includes(kw)
            );
            if (containsForbidden) return false;

            if (refDurationSec > 0) {
              const diff = Math.abs(v.durationSeconds - refDurationSec);
              return diff <= tolerance;
            }
            return true;
          });
        };

        // Tier 1: 30s match (Standard)
        matchedVideo = findMatch(30);
        
        // Tier 2: 60s match (Extended intro/outro videos)
        if (!matchedVideo && refDurationSec > 0) {
          matchedVideo = findMatch(60);
        }

        if (matchedVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${matchedVideo.videoId}`;
          
          await supabaseAdmin.from('repertoire').update({
            youtube_url: youtubeUrl,
            metadata_source: 'auto_populated',
            sync_status: 'COMPLETED',
            last_sync_log: `Bound: ${matchedVideo.videoId} (Tolerance: ${Math.abs(matchedVideo.durationSeconds - (refDurationSec || 0))}s)`
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: song.title, videoId: matchedVideo.videoId });
        } else {
          throw new Error("No match found within the 60-second audio duration constraint.");
        }

      } catch (err: any) {
        console.error(`[bulk-populate-youtube-links] Error on track ${id}:`, err.message);
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: err.message 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: err.message, song_id: id });
      }

      await new Promise(r => setTimeout(r, 800)); // Rate limit protection
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