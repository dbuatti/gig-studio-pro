"use client";
// @ts-ignore: Deno runtime import
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Utility Functions (Copied from client-side for Deno environment) ---

const SHARP_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_KEYS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const MAPPING_TO_SHARP: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

const MAPPING_TO_FLAT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb"
};

// Robust musical chord regex that handles sharps/flats and common extensions.
// It ensures the chord is a standalone entity by using negative lookbehind and lookahead for word characters.
// The chordType group is now more specific to actual chord suffixes, including maj7.
const CHORD_REGEX = /(?<!\w)([A-G][#b]?)(maj7|maj|m|dim|aug|sus\d?|add\d?|\d+)?(\/[A-G][#b]?)?(?!\w)/g;

function normalizeKeyString(key: string | undefined | null): string {
  if (!key || key === "TBC" || /^\d/.test(key)) return "TBC";
  let normalized = key.trim();
  if (normalized.toLowerCase().includes("minor")) {
    normalized = normalized.split(' ')[0] + "m";
  } else if (normalized.toLowerCase().includes("major")) {
    normalized = normalized.split(' ')[0];
  }
  if (normalized.endsWith('m')) {
    const root = normalized.slice(0, -1);
    const cappedRoot = root.charAt(0).toUpperCase() + root.slice(1).toLowerCase();
    return cappedRoot + 'm';
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function formatKey(key: string | undefined, preference: 'flats' | 'sharps'): string {
  const normKey = normalizeKeyString(key);
  if (normKey === "TBC") return "TBC";
  const isMinor = normKey.endsWith('m');
  const root = isMinor ? normKey.slice(0, -1) : normKey;
  let newRoot = root;
  if (preference === 'flats') {
    newRoot = MAPPING_TO_FLAT[root] || root;
  } else {
    newRoot = MAPPING_TO_SHARP[root] || root;
  }
  return isMinor ? `${newRoot}m` : newRoot;
}

function extractKeyFromChords(text: string): string | null {
  if (!text) return null;
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      continue;
    }
    // Use matchAll to find all occurrences and pick the first one
    const matches = Array.from(line.matchAll(CHORD_REGEX));
    if (matches.length > 0) {
      const match = matches[0]; // Take the first match
      const rootNote = match[1];
      const chordSuffix = match[2]; 
      
      if (rootNote) {
        const isMinor = chordSuffix && (chordSuffix.includes('m') || chordSuffix.includes('dim'));
        const normalizedRoot = MAPPING_TO_SHARP[rootNote] || rootNote;
        return normalizedRoot + (isMinor ? 'm' : '');
      }
    }
  }
  return null;
}

// --- Edge Function Logic ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore: Deno global
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { songIds, userId } = await req.json();
    
    if (!songIds || !Array.isArray(songIds) || !userId) {
      throw new Error("Invalid song IDs or user ID provided.");
    }

    const results = [];

    // Fetch user's key preference
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('key_preference')
      .eq('id', userId)
      .single();

    const userKeyPreference = profile?.key_preference || 'sharps';

    for (const id of songIds) {
      try {
        const { data: song, error: fetchErr } = await supabaseAdmin
          .from('repertoire')
          .select('id, title, artist, ug_chords_text, original_key, target_key, pitch, is_key_confirmed')
          .eq('id', id)
          .single();

        if (fetchErr || !song) throw new Error(`Fetch failed for ID ${id}`);

        if (song.ug_chords_text && (!song.original_key || song.original_key === "TBC")) {
          const rawExtractedKey = extractKeyFromChords(song.ug_chords_text);
          
          if (rawExtractedKey) {
            const formattedOriginalKey = formatKey(rawExtractedKey, userKeyPreference);
            const now = new Date().toISOString();

            const updates = {
              original_key: formattedOriginalKey,
              target_key: formattedOriginalKey, // Set targetKey to be the same as originalKey
              pitch: 0, 
              is_key_confirmed: true,
              original_key_updated_at: now, // CRITICAL: Update goal timestamps
              target_key_updated_at: now,   // CRITICAL: Update goal timestamps
              updated_at: now,
            };

            const { error: updateErr } = await supabaseAdmin
              .from('repertoire')
              .update(updates)
              .eq('id', id);

            if (updateErr) throw updateErr;

            results.push({ id, status: 'SUCCESS', title: song.title, originalKey: formattedOriginalKey });
          } else {
            results.push({ id, status: 'SKIPPED', title: song.title, msg: 'No key extracted from chords.' });
          }
        } else {
          results.push({ id, status: 'SKIPPED', title: song.title, msg: 'No chords or key already present.' });
        }

      } catch (err: any) {
        results.push({ id, status: 'ERROR', msg: err.message, title: (err.song && err.song.title) || 'Unknown' });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})