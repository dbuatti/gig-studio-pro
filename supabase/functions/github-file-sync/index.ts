// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { path, content, repo, message } = await req.json();
    
    // @ts-ignore: Deno access
    const GITHUB_PAT = Deno.env.get('GITHUB_PAT');

    if (!GITHUB_PAT) {
      console.error("[SYNC] GITHUB_PAT is not defined in project secrets.");
      return new Response(JSON.stringify({ 
        error: "GITHUB_PAT missing in project secrets. Please add it to your Supabase project settings." 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[SYNC] Syncing ${path} to ${repo}...`);

    const getUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const getRes = await fetch(getUrl, {
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    } else if (getRes.status !== 404) {
      const errData = await getRes.json();
      throw new Error(`GitHub GET Error: ${errData.message}`);
    }

    // Use TextEncoder to handle potential UTF-8 characters in the cookie file correctly
    const encodedContent = btoa(new TextEncoder().encode(content).reduce((data, byte) => data + String.fromCharCode(byte), ''));

    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: encodedContent,
        sha: sha || undefined
      })
    });

    const result = await putRes.json();
    
    if (!putRes.ok) {
      throw new Error(`GitHub PUT Error: ${result.message}`);
    }

    return new Response(JSON.stringify({ success: true, commit: result.commit.sha }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[SYNC] Failure: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})