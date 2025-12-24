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
    
    const GITHUB_PAT = (globalThis as any).Deno.env.get('GITHUB_PAT');

    if (!GITHUB_PAT) {
      throw new Error("GitHub PAT not configured in Supabase Secrets.");
    }

    // 1. Get current file SHA to perform a clean update
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
    }

    // 2. Perform the update
    const putRes = await fetch(getUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: btoa(content), // Base64 encode content
        sha: sha || undefined
      })
    });

    const result = await putRes.json();
    
    if (!putRes.ok) {
      throw new Error(result.message || "GitHub API Error");
    }

    return new Response(JSON.stringify({ success: true, commit: result.commit.sha }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})