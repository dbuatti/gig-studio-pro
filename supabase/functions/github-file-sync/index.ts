// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Encodes a string to Base64 using TextEncoder for standard Deno/Web support.
 */
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
      console.error("[SYNC ERROR] GITHUB_PAT is not set in Supabase Secrets.");
      return new Response(JSON.stringify({ 
        error: "GITHUB_PAT missing in project secrets. Please add it to your Supabase vault." 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    // 1. Fetch current file to get the SHA
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Supabase-Edge-Function'
      }
    });

    let sha = null;
    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      console.error(`[SYNC ERROR] GitHub GET failed (${getRes.status}): ${errText}`);
      throw new Error(`GitHub access failed. Check if the repository and token are valid.`);
    }

    // 2. Push the update
    const encodedContent = encodeBase64(content);
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Supabase-Edge-Function'
      },
      body: JSON.stringify({
        message: message || 'Update from Gig Studio',
        content: encodedContent,
        sha: sha || undefined
      })
    });

    const result = await putRes.json();
    
    if (!putRes.ok) {
      console.error(`[SYNC ERROR] GitHub PUT failed (${putRes.status}):`, result);
      throw new Error(result.message || "GitHub write operation failed.");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      commit: result.commit.sha 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[CRITICAL FAILURE]: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})