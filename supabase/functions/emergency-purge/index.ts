// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno global
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("[emergency-purge] Starting administrative storage wipe...");

    const { data: folders, error: listError } = await supabaseAdmin
      .storage
      .from('public_audio')
      .list();

    if (listError) throw listError;

    let totalDeleted = 0;

    for (const folder of (folders || []).slice(0, 10)) {
      const { data: subFolders } = await supabaseAdmin
        .storage
        .from('public_audio')
        .list(folder.name);

      if (subFolders) {
        for (const sub of subFolders) {
          const path = `${folder.name}/${sub.name}`;
          const { data: files } = await supabaseAdmin.storage.from('public_audio').list(path);
          
          if (files && files.length > 0) {
            const paths = files.map(f => `${path}/${f.name}`);
            const { error: delErr } = await supabaseAdmin.storage.from('public_audio').remove(paths);
            if (!delErr) totalDeleted += paths.length;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: totalDeleted,
        message: "Emergency purge complete." 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})