import { supabase } from '../src/integrations/supabase/client.js';
import { normalizeSearch } from '../src/utils/searchUtils';

interface SongToMatch {
  title: string;
  duration: string; // Format "MM:SS"
}

const targetSetlistName = "Royce – Party Set";
const targetSongs: SongToMatch[] = [
  { title: "New York, New York", duration: "3:30" },
  { title: "Sweet Caroline", duration: "3:30" },
  { title: "Piano Man", duration: "4:00" },
  { title: "Valerie", duration: "3:00" },
  { title: "I'm Still Standing", duration: "3:00" },
  { title: "Dancing Queen", duration: "3:30" },
  { title: "I Wanna Dance with Somebody", duration: "3:30" },
  { title: "Don't Stop Me Now", duration: "3:30" },
  { title: "Don't Stop Believin'", duration: "4:00" },
];

const spareSongs: SongToMatch[] = [
  { title: "Mr Brightside", duration: "4:00" }, // Assuming durations for spares
  { title: "Shut Up and Dance", duration: "3:13" },
  { title: "Footloose", duration: "3:46" },
  { title: "You're the One That I Want", duration: "2:49" },
];

const allSongsToMatch = [...targetSongs, ...spareSongs];

// Function to convert MM:SS to seconds
const parseDurationToSeconds = (duration: string): number => {
  const parts = duration.split(':').map(Number);
  return parts[0] * 60 + parts[1];
};

async function createRoycePartySet() {
  console.log(`\nAttempting to create setlist: "${targetSetlistName}"`);

  // 1. Create the new setlist entry
  const { data: newSetlist, error: setlistError } = await supabase
    .from('setlists')
    .insert({ name: targetSetlistName })
    .select()
    .single();

  if (setlistError) {
    if (setlistError.code === '23505') { // Unique violation
      console.warn(`Setlist "${targetSetlistName}" already exists. Proceeding with existing setlist.`);
      const { data: existingSetlist, error } = await supabase
        .from('setlists')
        .select()
        .eq('name', targetSetlistName)
        .single();
      if (error || !existingSetlist) {
        console.error('Error fetching existing setlist:', error?.message);
        return;
      }
      Object.assign(newSetlist, existingSetlist); // Merge properties to use existing setlist data
    } else {
      console.error('Error creating setlist:', setlistError.message);
      return;
    }
  }

  if (!newSetlist?.id) {
    console.error('Could not obtain setlist ID.');
    return;
  }

  console.log(`Setlist "${newSetlist.name}" (ID: ${newSetlist.id}) created or retrieved successfully.`);

  // 2. Fetch all repertoire songs for fuzzy matching
  const { data: repertoire, error: repertoireError } = await supabase
    .from('repertoire')
    .select('id, title, artist, duration_seconds');

  if (repertoireError) {
    console.error('Error fetching repertoire:', repertoireError.message);
    return;
  }

  const normalizedRepertoire = repertoire.map(song => ({
    ...song,
    normalizedTitle: normalizeSearch(song.title),
  }));

  const matchedSongs: { songTitle: string; dbTitle: string; id: string; duration_seconds: number | null }[] = [];
  const missingSongs: string[] = [];
  let totalDurationSeconds = 0;
  let sortOrder = 0;

  console.log('\nMatching songs to repertoire...');

  for (const songToMatch of allSongsToMatch) {
    const normalizedQuery = normalizeSearch(songToMatch.title);
    const foundSong = normalizedRepertoire.find(
      (s) => s.normalizedTitle === normalizedQuery || s.normalizedTitle.includes(normalizedQuery)
    );

    if (foundSong) {
      // 3. Add the matched song to the new setlist
      const { error: insertError } = await supabase
        .from('setlist_songs')
        .insert({
          setlist_id: newSetlist.id,
          song_id: foundSong.id,
          sort_order: sortOrder,
          // You might want to override set_group if this setlist has multiple groups
          // For now, assume a single group or let the default handle it.
        });

      if (insertError) {
        console.error(`Error adding "${foundSong.title}" to setlist:`, insertError.message);
        // If it's a unique constraint violation (song already in setlist), just log and continue
        if (insertError.code === '23505') {
          console.warn(`Song "${foundSong.title}" is already in setlist "${newSetlist.name}".`);
        } else {
          continue; // Skip to next song if a real error occurs
        }
      } else {
        matchedSongs.push({
          songTitle: songToMatch.title,
          dbTitle: foundSong.title,
          id: foundSong.id,
          duration_seconds: foundSong.duration_seconds,
        });
        totalDurationSeconds += foundSong.duration_seconds || parseDurationToSeconds(songToMatch.duration);
        sortOrder++;
      }
    } else {
      missingSongs.push(songToMatch.title);
    }
  }

  // 4. Print results
  console.log('\n--- Setlist Creation Report ---');
  console.log(`Setlist Name: ${newSetlist.name}`);
  console.log('\nMatched Songs:');
  if (matchedSongs.length > 0) {
    matchedSongs.forEach(s => console.log(`  ✓ "${s.songTitle}" (Matched to: "${s.dbTitle}", ID: ${s.id})`));
  } else {
    console.log('  No songs were matched.');
  }

  console.log('\nMissing Songs (could not be fuzzy matched in your repertoire):');
  if (missingSongs.length > 0) {
    missingSongs.forEach(s => console.log(`  ✗ "${s}"`));
  } else {
    console.log('  All specified songs were matched!');
  }

  const totalMinutes = Math.floor(totalDurationSeconds / 60);
  const remainingSeconds = totalDurationSeconds % 60;
  console.log(`\nTotal Running Time (estimated): ${totalMinutes}m ${remainingSeconds}s`);
  console.log('\n-------------------------------\n');
}

createRoycePartySet().catch(console.error);
