// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { encodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

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
      return new Response(JSON.stringify({ 
        error: "Missing GITHUB_PAT secret in Supabase." 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    // 1. Get current file SHA
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

    // 2. Push update
    const encodedContent = encodeBase64(content);
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'GigStudio-Sync'
      },
      body: JSON.stringify({
        message: message || 'Update via Studio Admin',
        content: encodedContent,
        sha: sha || undefined
      })
    });

    const result = await putRes.json();
    
    if (!putRes.ok) {
      // Return the full GitHub response for diagnosis
      return new Response(JSON.stringify({ 
        error: result.message || "GitHub write failed.",
        details: result 
      }), { 
        status: putRes.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ success: true, commit: result.commit.sha }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})