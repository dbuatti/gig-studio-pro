// Bulk Pull Keys Edge Function
// Last Deploy: 2024-05-20T10:00:00Z
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_TO_INDEX: Record<string, number> = { "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11 };
const CHORD_REGEX = /(?<!\w)([A-G][#b]?)(m|maj|min|aug|dim|sus|add|M)?([0-9]{1,2})?(?:(sus|add|maj|min|dim|aug|[\+\-\^])[0-9]{1,2})*(\/[A-G][#b]?)?(?!\w)/g;

function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return false;
  const words = trimmed.split(/\s+/);
  let chordCount = 0;
  let wordCount = 0;
  for (const word of words) {
    if (word.match(/^([A-G][#b]?)(m|maj|min|aug|dim|sus|add|M)?([0-9]{1,2})?((sus|add|maj|min|dim|aug|[\+\-\^])[0-9]{1,2})*(\/[A-G][#b]?)?$/)) chordCount++;
    else if (word.length > 2 && !word.includes('|')) wordCount++;
  }
  return chordCount > wordCount || (chordCount > 0 && wordCount === 0);
}

function extractKeyFromChords(text: string): string | null {
  if (!text) return null;
  const chords: Record<string, number> = {};
  const lines = text.split('\n');
  let firstChord: string | null = null;
  for (const line of lines) {
    if (!isChordLine(line)) continue;
    const matches = Array.from(line.matchAll(CHORD_REGEX));
    for (const match of matches) {
      const root = match[1];
      const suffix = match[2] || '';
      const isMinor = suffix.includes('m') || suffix.includes('min') || suffix.includes('dim');
      const chord = root + (isMinor ? 'm' : '');
      if (!firstChord) firstChord = chord;
      chords[chord] = (chords[chord] || 0) + 1;
    }
  }
  if (Object.keys(chords).length === 0) return null;
  const sorted = Object.entries(chords).sort((a, b) => b[1] - a[1]);
  const mostFrequent = sorted[0][0];
  if (firstChord && chords[firstChord] >= sorted[0][1] * 0.5) return firstChord;
  return mostFrequent;
}

function formatKey(key: string | undefined, preference: 'flats' | 'sharps'): string {
  if (!key || key === "TBC") return "TBC";
  const isMinor = key.endsWith('m');
  const base = key.replace('m', '');
  const index = NOTE_TO_INDEX[base];
  if (index === undefined) return key;
  const list = preference === 'flats' ? FLAT_NOTES : SHARP_NOTES;
  return list[index] + (isMinor ? 'm' : '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { songIds } = await req.json();
    if (!songIds || !Array.isArray(songIds)) throw new Error("Invalid song IDs.");

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { data: profile } = await supabaseAdmin.from('profiles').select('key_preference').eq('id', user.id).single();
    const userKeyPreference = profile?.key_preference || 'sharps';
    const results = [];

    for (const id of songIds) {
      try {
        // Ownership check: Ensure song belongs to the authenticated user
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, ug_chords_text, original_key')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (fetchErr || !song) {
          results.push({ id, status: 'ERROR', msg: 'Song not found or access denied.' });
          continue;
        }

        if (song.ug_chords_text && (!song.original_key || song.original_key === "TBC")) {
          const rawExtractedKey = extractKeyFromChords(song.ug_chords_text);
          if (rawExtractedKey) {
            const formattedKeyStr = formatKey(rawExtractedKey, userKeyPreference);
            const now = new Date().toISOString();
            await supabaseAdmin.from('repertoire').update({
              original_key: formattedKeyStr,
              target_key: formattedKeyStr,
              pitch: 0,
              is_key_confirmed: true,
              original_key_updated_at: now,
              target_key_updated_at: now,
              updated_at: now,
            }).eq('id', id);
            results.push({ id, status: 'SUCCESS', title: song.title, originalKey: formattedKeyStr });
          } else {
            results.push({ id, status: 'SKIPPED', title: song.title, msg: 'No key extracted.' });
          }
        } else {
          results.push({ id, status: 'SKIPPED', title: song.title, msg: 'Already has key or no chords.' });
        }
      } catch (err: any) {
        results.push({ id, status: 'ERROR', msg: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})