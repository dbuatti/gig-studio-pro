// ... (lines 1-79 unchanged)
    if (song.originalKey !== undefined && song.originalKey !== "TBC") {
      dbUpdates.original_key = song.originalKey;
      dbUpdates.original_key_updated_at = now;
    }
    if (song.targetKey !== undefined && song.targetKey !== "TBC") {
      dbUpdates.target_key = song.targetKey;
      dbUpdates.target_key_updated_at = now;
    }
    if (song.pdfUrl !== undefined || song.leadsheetUrl !== undefined || song.sheet_music_url !== undefined) {
      dbUpdates.pdf_updated_at = now;
    }

    if (song.previewUrl !== undefined) dbUpdates.preview_url = song.previewUrl;
    if (song.youtubeUrl !== undefined) dbUpdates.youtube_url = song.youtubeUrl;
    if (song.appleMusicUrl !== undefined) dbUpdates.apple_music_url = song.appleMusicUrl;
    if (song.pdfUrl !== undefined) dbUpdates.pdf_url = song.pdfUrl;
    if (song.leadsheetUrl !== undefined) dbUpdates.leadsheet_url = song.leadsheetUrl;
    
    if (song.pitch !== undefined) dbUpdates.pitch = song.pitch;
    if (song.bpm !== undefined) dbUpdates.bpm = song.bpm;
    if (song.genre !== undefined) dbUpdates.genre = song.genre;
    if (song.isMetadataConfirmed !== undefined) dbUpdates.is_metadata_confirmed = song.isMetadataConfirmed;
    if (song.isKeyConfirmed !== undefined) dbUpdates.is_key_confirmed = song.isKeyConfirmed;
    if (song.notes !== undefined) dbUpdates.notes = song.notes;
    if (song.resources !== undefined) dbUpdates.resources = song.resources;
    if (song.user_tags !== undefined) dbUpdates.user_tags = song.user_tags;
    if (song.isPitchLinked !== undefined) dbUpdates.is_pitch_linked = song.isPitchLinked;
    if (song.duration_seconds !== undefined) dbUpdates.duration_seconds = Math.round(song.duration_seconds || 0);
    if (song.isApproved !== undefined) dbUpdates.is_approved = song.isApproved;
    if (song.is_ready_to_sing !== undefined) dbUpdates.is_ready_to_sing = song.is_ready_to_sing;
    if (song.preferred_reader !== undefined) dbUpdates.preferred_reader = song.preferred_reader;
    if (song.ug_chords_config !== undefined) dbUpdates.ug_chords_config = song.ug_chords_config;
    if (song.is_ug_chords_present !== undefined) dbUpdates.is_ug_chords_present = song.is_ug_chords_present;
    if (song.key_preference !== undefined) dbUpdates.key_preference = song.key_preference;
    if (song.audio_url !== undefined) dbUpdates.audio_url = song.audio_url;
    if (song.extraction_status !== undefined) dbUpdates.extraction_status = song.extraction_status;
// ... (rest of file unchanged)