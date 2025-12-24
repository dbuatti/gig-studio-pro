// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { encode as encodeBase64 } from "https://deno.land/std@0.160.0/encoding/base64.ts"

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
      console.error("[SYNC ERROR] GITHUB_PAT secret is missing in Supabase.");
      return new Response(JSON.stringify({ 
        error: "Missing GITHUB_PAT. Please add your GitHub Personal Access Token to the Supabase Edge Function secrets." 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    // 1. Fetch current file to get the SHA (required for updating existing files)
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
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      throw new Error(`GitHub connectivity failed (${getRes.status}): ${errText}`);
    }

    // 2. Prepare the payload with Base64 content
    // We use the standard Deno utility for reliable binary-safe encoding
    const encodedContent = encodeBase64(content);
    
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
      console.error(`[SYNC ERROR] GitHub Write Failed (${putRes.status}):`, result);
      throw new Error(result.message || "The GitHub write operation was rejected by the API.");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      commit: result.commit.sha 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[RUNTIME ERROR]: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: "Check function logs for full trace."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})