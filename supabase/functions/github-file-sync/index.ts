// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { encodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { path, content, repo, message } = await req.json();
    
    // @ts-ignore: Deno access
    const GITHUB_PAT = Deno.env.get('GITHUB_PAT');

    if (!GITHUB_PAT) {
      console.error("[ADMIN SYNC] GITHUB_PAT is missing from environment variables.");
      return new Response(JSON.stringify({ 
        error: "Missing GITHUB_PAT. Please ensure the GitHub Personal Access Token is set in Supabase Project Settings -> Edge Functions -> Manage Secrets." 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    console.log(`[ADMIN SYNC] Contacting GitHub API: ${apiUrl}`);
    
    // 1. Fetch current file to get the SHA (required for updates)
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GigStudio-Sync-Engine'
      }
    });

    let sha = null;
    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      console.log(`[ADMIN SYNC] Found existing file, SHA: ${sha}`);
    } else if (getRes.status === 404) {
      console.log(`[ADMIN SYNC] File not found, creating new one.`);
    } else {
      const errText = await getRes.text();
      console.error(`[ADMIN SYNC] GitHub GET error (${getRes.status}): ${errText}`);
      throw new Error(`GitHub connectivity failed (${getRes.status}). Check if the repo path is correct and token has permissions.`);
    }

    // 2. Encode content to Base64 using standard Deno utility
    const encodedContent = encodeBase64(content);
    
    console.log(`[ADMIN SYNC] Pushing updates to GitHub...`);
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GigStudio-Sync-Engine'
      },
      body: JSON.stringify({
        message: message || 'Update via Gig Studio Dashboard',
        content: encodedContent,
        sha: sha || undefined
      })
    });

    const result = await putRes.json();
    
    if (!putRes.ok) {
      console.error(`[ADMIN SYNC] GitHub PUT error: ${JSON.stringify(result)}`);
      throw new Error(result.message || "The GitHub write operation was rejected by the API.");
    }

    console.log(`[ADMIN SYNC] Success! Commit: ${result.commit.sha}`);
    return new Response(JSON.stringify({ 
      success: true, 
      commit: result.commit.sha 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[ADMIN SYNC] Fatal error: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: "Check Edge Function logs in Supabase Console for full trace."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})