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
      let lastSyncLog = '';
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        if (song.metadata_source === 'itunes_autosync' && !overwrite) {
          lastSyncLog = 'Already synced. Skipped.';
          results.push({ id, status: 'SKIPPED', msg: lastSyncLog });
          await supabaseAdmin.from('repertoire').update({ sync_status: 'COMPLETED', last_sync_log: lastSyncLog }).eq('id', id);
          continue;
        }

        await supabaseAdmin.from('repertoire').update({ sync_status: 'SYNCING', last_sync_log: 'Starting sync...' }).eq('id', id);

        // 1. Metadata Enrichment (iTunes)
        const itunesQuery = encodeURIComponent(`${song.artist} ${song.title}`);
        const itunesRes = await fetch(`https://itunes.apple.com/search?term=${itunesQuery}&entity=song&limit=1`);
        
        if (!itunesRes.ok) {
          const errorText = await itunesRes.text();
          throw new Error(`iTunes API request failed: ${itunesRes.status} - ${errorText.substring(0, 100)}`);
        }
        
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
        } else {
          lastSyncLog = 'No iTunes match found.';
          throw new Error(lastSyncLog);
        }

        // 2. Refined Search Query (Level 1: Strict)
        const searchArtist = topResult?.artistName || song.artist;
        const searchTitle = topResult?.trackName || song.title;
        const ytSearchQuery = `${searchArtist} - ${searchTitle} (Official Audio)`;

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

        let videos: any[] = [];
        let searchSuccess = false;

        for (const instance of INVIDIOUS_INSTANCES) {
          try {
            const ytRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(ytSearchQuery)}`);
            if (ytRes.ok) {
              const data = await ytRes.json();
              const filtered = data?.filter?.((v: any) => v.type === "video") || [];
              if (filtered.length > 0) {
                videos = filtered;
                searchSuccess = true;
                console.log(`[global-auto-sync] [${song.title}] YouTube hits found on ${instance}`);
                break;
              }
            }
          } catch (e) {
            console.warn(`[global-auto-sync] Instance ${instance} failed for query ${ytSearchQuery}`);
          }
        }

        if (!searchSuccess) {
          lastSyncLog = 'No YouTube search results found across instances.';
          throw new Error(lastSyncLog);
        }

        let matchedVideo = null;
        const EXCLUDED_KEYWORDS = ['cover', 'tutorial', 'karaoke', 'lesson', 'instrumental', 'remix'];
        const songTitleLower = song.title.toLowerCase();

        // 3. Duration Matching (Constraint: +/- 30s)
        const findMatch = (tolerance: number | null) => {
          return videos.find(v => {
            const vTitleLower = v.title.toLowerCase();
            const containsForbidden = EXCLUDED_KEYWORDS.some(kw => 
              vTitleLower.includes(kw) && !songTitleLower.includes(kw)
            );
            if (containsForbidden) return false;

            if (tolerance !== null && itunesDurationSec > 0) {
              const diff = Math.abs(v.durationSeconds - itunesDurationSec);
              return diff <= tolerance;
            }
            return true; // If no duration to compare or tolerance is null, any non-forbidden video is a match
          });
        };

        matchedVideo = findMatch(30); // Tier 1: Strict 30s match
        if (!matchedVideo) matchedVideo = findMatch(60); // Tier 2: Relaxed 60s match
        if (!matchedVideo) { // Tier 3: Fallback to best non-forbidden video if no duration match
          console.log(`[global-auto-sync] [${song.title}] No duration match found. Falling back to best non-forbidden hit.`);
          matchedVideo = findMatch(null);
        }

        if (matchedVideo) {
          const youtubeUrl = `https://www.youtube.com/watch?v=${matchedVideo.videoId}`;
          const diff = itunesDurationSec ? Math.abs(matchedVideo.durationSeconds - itunesDurationSec) : 'N/A';
          
          lastSyncLog = `Matched: ${matchedVideo.title} (Duration Delta: ${diff}s)`;
          await supabaseAdmin.from('repertoire').update({
            ...enrichedMetadata,
            youtube_url: youtubeUrl,
            sync_status: 'COMPLETED',
            last_sync_log: lastSyncLog
          }).eq('id', id);

          results.push({ id, status: 'SUCCESS', title: matchedVideo.title });
        } else {
          lastSyncLog = "No suitable YouTube match found meeting criteria.";
          throw new Error(lastSyncLog);
        }

      } catch (err: any) {
        console.error(`[global-auto-sync] Error on track ${id}:`, err.message);
        lastSyncLog = err.message;
        await supabaseAdmin.from('repertoire').update({ 
          sync_status: 'ERROR',
          last_sync_log: lastSyncLog 
        }).eq('id', id);
        results.push({ id, status: 'ERROR', msg: lastSyncLog });
      }

      await new Promise(r => setTimeout(r, 1500)); // Rate limit protection
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[global-auto-sync] Uncaught error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})