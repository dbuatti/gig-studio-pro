import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Song {
  id: string;
  name: string;
  artist: string;
  bpm?: string;
  genre?: string;
  energy_level?: string;
  readiness: number;
}

/**
 * Cleans AI response text to ensure it's valid JSON.
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { currentSetlist, repertoire, instruction } = await req.json() as { 
      currentSetlist: Song[], 
      repertoire: Song[],
      instruction?: string 
    };

    const providers = [
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY'), name: 'Pool #1' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_2'), name: 'Pool #2' },
      { type: 'google', key: Deno.env.get('GEMINI_API_KEY_3'), name: 'Pool #3' },
      { type: 'openrouter', key: Deno.env.get('OPENROUTER_API_KEY'), name: 'OpenRouter' }
    ].filter(p => !!p.key);

    if (providers.length === 0) {
      throw new Error('No AI provider keys found in environment.');
    }

    // Shuffle to distribute load
    const shuffledProviders = [...providers].sort(() => Math.random() - 0.5);

    // Filter out songs already in the setlist
    const currentIds = new Set(currentSetlist.map(s => s.id));
    const candidates = repertoire.filter(s => !currentIds.has(s.id));

    if (candidates.length === 0) {
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    const prompt = `You are a world-class Musical Director. 
CURRENT SETLIST:
${currentSetlist.map((s, i) => \`\${i + 1}. \${s.name} (\${s.artist}) | Energy: \${s.energy_level} | BPM: \${s.bpm}\`).join('\n')}

AVAILABLE REPERTOIRE CANDIDATES:
${candidates.map((s) => \`ID: \${s.id} | \${s.name} (\${s.artist}) | Energy: \${s.energy_level} | BPM: \${s.bpm} | Readiness: \${s.readiness}% | Genre: \${s.genre}\`).join('\n')}

USER INSTRUCTION: "\${instruction || 'Suggest 3 songs that would improve the flow and energy of this set.'}"

TASK:
Pick the 3 BEST songs from the candidates that would work well in this set.
Consider:
1. Energy Flow: Does the set need a high-energy peak or a soft ambient break?
2. Technical Readiness: Prioritize songs with >70% readiness.
3. Genre/Vibe: Maintain or intentionally shift the vibe.

OUTPUT:
Return ONLY a JSON array of objects with "id" and "reason" (a short 1-sentence explanation why it fits).
Example: [{"id": "uuid", "reason": "Perfect high-energy transition after the mid-set ballad."}]`;

    let lastError = null;

    for (const provider of shuffledProviders) {
      try {
        console.log(\`[suggest-songs] Attempting suggestions via \${provider.type.toUpperCase()} (\${provider.name})...\`);
        let content = "";

        if (provider.type === 'google') {
          // Using gemini-2.5-flash as requested
          const response = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${provider.key}\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.7
              }
            })
          });
          
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "Google API error");
          content = result.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": \`Bearer \${provider.key}\`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.7
            })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error?.message || "OpenRouter API error");
          content = result.choices?.[0]?.message?.content;
        }

        if (content) {
          const cleanedContent = cleanJsonResponse(content);
          // Validate JSON
          JSON.parse(cleanedContent);
          
          return new Response(cleanedContent, { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      } catch (err: any) {
        console.warn(\`[suggest-songs] Provider \${provider.name} failed: \${err.message}\`);
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error("All AI providers failed.");

  } catch (error: any) {
    console.error("[suggest-songs] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});