"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Waves } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SetlistSong, INITIAL_FILTERS, FilterState } from '@/components/SetlistManager';
import { showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';

const Index = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  
  // Define missing state variables (assuming they are managed here)
  const [songs, setSongs] = useState<SetlistSong[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>('none');
  const [activeSongIdState, setActiveSongIdState] = useState<string | null>(null);

  const startSheetReader = useCallback((initialSongId?: string) => {
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
  }, [songs, activeSongIdState, navigate, setActiveFilters, setSearchTerm, setSortMode]);

  // Placeholder content for the Index page
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <span className="font-black uppercase tracking-tighter text-xl">Gig Studio <span className="text-indigo-600">Pro</span></span>
        </div>
        <Button 
          onClick={() => startSheetReader()}
          className="bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl shadow-lg shadow-indigo-600/20"
        >
          Start Reader
        </Button>
      </nav>
      <div className="pt-24 p-8">
        <h1 className="text-3xl font-bold">Dashboard (Placeholder)</h1>
        <p className="text-slate-400">This is the Index page. Functionality is currently limited to the startSheetReader logic.</p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;