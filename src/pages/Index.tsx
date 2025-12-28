// ... (Existing imports and code)

  const startSheetReader = (initialSongId?: string) => {
    // Reset filters to ensure songs are visible in the Reader
    setActiveFilters(INITIAL_FILTERS);
    setSearchTerm("");
    setSortMode("none");
    
    // Calculate readable songs based on the full list (not filtered)
    const readable = songs.filter(s => 
      s.ugUrl || 
      s.pdfUrl || 
      s.leadsheetUrl || 
      s.ug_chords_text
    );
    
    if (!readable.length) {
      showError("No readable charts found.");
      return;
    }
    
    // Set flag before navigating
    sessionStorage.setItem('from_dashboard', 'true');

    // If we have an active song, pass it to the reader
    if (activeSongIdState) {
      navigate(`/sheet-reader/${activeSongIdState}`);
    } else {
      navigate('/sheet-reader');
    }
  };

// ... (Rest of the component)