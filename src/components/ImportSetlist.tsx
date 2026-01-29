newSongs.push({
          id: crypto.randomUUID(),
          name: title,
          artist: artist,
          previewUrl: "", 
          youtubeUrl,
          originalKey: originalKey,
          targetKey: originalKey,
          pitch: 0,
          isPlayed: false,
          isMetadataConfirmed: false
        });