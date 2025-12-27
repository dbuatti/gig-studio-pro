// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Expanded list of reliable Invidious instances for high availability
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

    console.log(`[bulk-populate-youtube-links] Starting batch process for ${songIds.length} tracks.`);

    const results = [];
    const EXCLUDED_KEYWORDS = ['cover', 'tutorial', 'karaoke', 'lesson', 'instrumental', 'remix'];

    for (const id of songIds) {
      let lastSyncLog = '';
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING', last_sync_log: 'Starting link population...' }).eq('id', id);

        // 1. Get Reference Duration from iTunes (High Precision Metadata)
        console.log(`[bulk-populate-youtube-links] [${song.title}] Fetching iTunes reference...`);
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        
        if (!itunesRes.ok) {
          const errorText = await itunesRes.text();
          console.error(`[bulk-populate-youtube-links] iTunes API request failed: ${itunesRes.status} - ${errorText.substring(0, 100)}`);
          // Don't throw, just log and continue without iTunes duration
          lastSyncLog += `iTunes API failed: ${itunesRes.status}. `;
        }
        
        const itunesData = await itunesRes.json();
        const topItunes = itunesData.results?.[0];
        const refDurationSec = topItunes ? Math.floor(topItunes.trackTimeMillis / 1000) : 0;
        if (refDurationSec > 0) {
          lastSyncLog += `iTunes duration: ${refDurationSec}s. `;
        } else {
          lastSyncLog += `No iTunes duration found. `;
        }

        // 2. Refined Multi-Pass Search
        const searchArtist = topItunes?.artistName || song.artist;
        const searchTitle = topItunes?.trackName || song.title;
        
        const queries = [
          `${searchArtist} - ${searchTitle} (Official Audio)`,
          `${searchArtist} - ${searchTitle} (Official Lyric Video)`,
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
                  console.log(`[bulk-populate-youtube-links] [${song.title}] YouTube hits found on ${instance}`);
                  break;
                }
              }
            } catch (e) {
              console.warn(`[bulk-populate-youtube-links] Instance ${instance} failed for query ${query}`);
            }
          }
        }

        if (!searchSuccess) {
          lastSyncLog += 'No YouTube search results found across instances.';
          throw new Error(lastSyncLog);
        }

        let matchedVideo = null;
        const songTitleLower = song.title.toLowerCase();

        // 3. Match Logic (Tiered Duration Matching)
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

        // Tier 1: 30s match (Standard)
        matchedVideo = findMatch(30);
        
        // Tier 2: 60s match (Extended)
        if (!matchedVideo) matchedVideo = findMatch(60);

        // Tier 3: Extreme Match (Ignore duration if we have a hit that isn't a forbidden keyword)
        if (!matchedVideo) {
          console.log(`[bulk-populate-youtube-links] [${song.title}] No duration match found. Falling back to best hit.`);
          matchedVideo = findMatch(null);
        }

        if (matchedVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${matchedVideo.videoId}`;
          const diff = refDurationSec ? Math.abs(matchedVideo.durationSeconds - refDurationSec) : 'N/A';
          
          lastSyncLog += `Bound: ${matchedVideo.videoId} (Duration Delta: ${diff}s)`;
          await supabaseAdmin.from('repertoire').update({
            youtube_url: youtubeUrl,
            metadata_source: 'auto_populated',
            sync_status: 'COMPLETED',
            last_sync_log: lastSyncLog
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: song.title, videoId: matchedVideo.videoId });
        } else {
          lastSyncLog += "No searchable records found for this track title/artist combination.";
          throw new Error(lastSyncLog);
        }

      } catch (err: any) {
        console.error(`[bulk-populate-youtube-links] Error on track ${id}:`, err.message);
        lastSyncLog = err.message;
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: lastSyncLog 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: lastSyncLog, song_id: id });
      }

      await new Promise(r => setTimeout(r, 600)); // Rate limit protection
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
    console.error(`[bulk-populate-youtube-links] Uncaught error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})