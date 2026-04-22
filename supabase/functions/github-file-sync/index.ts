// GitHub File Sync Edge Function
// Last Deploy: 2024-05-20T10:00:00Z
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { encodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";
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

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { path, content, repo, message } = await req.json();
    
    // Security: Restrict to specific authorized repositories if needed
    // For now, we just ensure it's provided.
    if (!repo) {
      return new Response(JSON.stringify({ error: "Repository is required" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // @ts-ignore
    const GITHUB_PAT = Deno.env.get('GITHUB_PAT');
    if (!GITHUB_PAT) {
      return new Response(JSON.stringify({ error: "Missing GITHUB_PAT secret." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const encodedContent = encodeBase64(content);
    
    const performUpdate = async (sha: string | null, commitMessage: string) => {
      return await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'GigStudio-Sync'
        },
        body: JSON.stringify({
          message: commitMessage,
          content: encodedContent,
          sha: sha || undefined
        })
      });
    };

    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GigStudio-Sync'
      }
    });

    let sha = null;
    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    let putRes = await performUpdate(sha, message || 'Update via Studio Admin');
    let result = await putRes.json();

    if (!putRes.ok) {
      return new Response(JSON.stringify({ error: result.message || "GitHub write failed." }), { status: putRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, commit: result.commit.sha }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})