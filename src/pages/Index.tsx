"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import PerformanceOverlay from "@/components/PerformanceOverlay";
import ActiveSongBanner from "@/components/ActiveSongBanner";
import SetlistStats from "@/components/SetlistStats";
import PreferencesModal from "@/components/PreferencesModal";
import AdminPanel from "@/components/AdminPanel";
import SongStudioModal from "@/components/SongStudioModal";
import SetlistSettingsModal from "@/components/SetlistSettingsModal";
import ResourceAuditModal from "@/components/ResourceAuditModal";
import RepertoirePicker from "@/components/RepertoirePicker";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  User as UserIcon, Loader2, Play, LayoutDashboard, 
  Search as SearchIcon, Rocket, Settings, Clock, 
  ShieldCheck, Settings2, FileText, Guitar, 
  Library, ListMusic, ClipboardCheck 
} from 'lucide-react'; 
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { syncToMasterRepertoire, calculateReadiness } from '@/utils/repertoireSync';
import * as Tone from 'tone';
import { cleanYoutubeUrl } from '@/utils/youtubeUtils';
import { useNavigate } from 'react-router-dom';
import { FilterState } from '@/components/SetlistFilters';

type ViewMode = 'repertoire' | 'setlist';

const Index = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { keyPreference } = useSettings();
  const navigate = useNavigate();
  
  // App State
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('gig_view_mode') as ViewMode) || 'repertoire';
  });
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[]; time_goal?: number }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(() => {
    return localStorage.getItem('active_gig_id');
  });
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  
  // UI Control State
  const [activeSongIdState, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false); 
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false); 
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work'>(() => {
    return (localStorage.getItem('gig_sort_mode') as any) || 'none';
  });
  
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    return saved ? JSON.parse(saved) : {
      hasAudio: 'all', hasVideo: 'all', hasChart: 'all',
      hasPdf: 'all', hasUg: 'all', isConfirmed: 'all',
      isApproved: 'all', readiness: 100, hasUgChords: 'all'
    };
  });
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const isSyncingRef = useRef(false);
  const saveQueueRef = useRef<any[]>([]);
  const transposerRef = useRef<AudioTransposerRef>(null);

  const currentList = setlists.find(l => l.id === currentListId);
  
  // Core Logic: Which songs are we displaying?
  const songs = useMemo(() => {
    if (viewMode === 'repertoire') return masterRepertoire;
    return currentList?.songs || [];
  }, [viewMode, masterRepertoire, currentList]);

  const processedSongs = useMemo(() => {
    let base = [...songs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      base = base.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.artist?.toLowerCase().includes(q)
      );
    }

    base = base.filter(s => {
      const score = calculateReadiness(s);
      if (score > activeFilters.readiness) return false;
      const hasFullAudio = !!s.previewUrl && !(s.previewUrl.includes('apple.com') || s.previewUrl.includes('itunes-assets'));
      if (activeFilters.hasAudio === 'full' && !hasFullAudio) return false;
      if (activeFilters.isApproved === 'yes' && !s.isApproved) return false;
      return true;
    });

    if (sortMode === 'none') return base;
    return base.sort((a, b) => {
      const scoreA = calculateReadiness(a);
      const scoreB = calculateReadiness(b);
      return sortMode === 'ready' ? scoreB - scoreA : scoreA - scoreB;
    });
  }, [songs, sortMode, searchTerm, activeFilters]);

  useEffect(() => {
    if (user) {
      fetchSetlists();
      fetchMasterRepertoire();
    }
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('gig_view_mode', viewMode);
  }, [viewMode]);

  const fetchMasterRepertoire = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('repertoire').select('*').eq('user_id', user.id).order('title');
      if (data) {
        setMasterRepertoire(data.map(d => ({
          id: d.id, master_id: d.id, name: d.title, artist: d.artist, bpm: d.bpm, lyrics: d.lyrics,
          originalKey: d.original_key, targetKey: d.target_key, pitch: d.pitch, ugUrl: d.ug_url,
          previewUrl: d.preview_url, youtubeUrl: d.youtube_url, appleMusicUrl: d.apple_music_url,
          pdfUrl: d.pdf_url, isMetadataConfirmed: d.is_metadata_confirmed, isKeyConfirmed: d.is_key_confirmed,
          duration_seconds: d.duration_seconds, notes: d.notes, user_tags: d.user_tags || [], resources: d.resources || [],
          isApproved: d.is_approved, preferred_reader: d.preferred_reader, ug_chords_text: d.ug_chords_text,
          ug_chords_config: d.ug_chords_config, is_pitch_linked: d.is_pitch_linked, is_ug_link_verified: d.is_ug_link_verified,
          sheet_music_url: d.sheet_music_url, is_sheet_verified: d.is_sheet_verified
        })));
      }
    } catch (err) {}
  };

  const fetchSetlists = async () => {
    try {
      const { data, error } = await supabase.from('setlists').select('*').order('updated_at', { ascending: false });
      if (data && data.length > 0) {
        setSetlists(data.map(d => ({ id: d.id, name: d.name, songs: (d.songs as any[]) || [], time_goal: d.time_goal })));
        if (!currentListId) setCurrentListId(data[0].id);
      }
    } catch (err) {}
  };

  const saveList = async (listId: string, updatedSongs: SetlistSong[], updates: any = {}, songsToSync?: SetlistSong[]) => {
    if (!user) return;
    setIsSaving(true);
    try {
      let finalSongs = updatedSongs;
      if (songsToSync?.length) {
        const syncedBatch = await syncToMasterRepertoire(user.id, songsToSync);
        finalSongs = updatedSongs.map(s => {
          const matched = syncedBatch.find(sb => sb.id === s.id || (sb.name === s.name && sb.artist === s.artist));
          return matched ? { ...s, master_id: matched.master_id } : s;
        });
      }
      
      const cleaned = finalSongs.map(({ isSyncing, ...rest }) => rest);
      await supabase.from('setlists').update({ songs: cleaned, updated_at: new Date().toISOString(), ...updates }).eq('id', listId);
      
      setSetlists(prev => prev.map(l => l.id === listId ? { ...l, songs: finalSongs, ...updates } : l));
      if (songsToSync?.length) fetchMasterRepertoire();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<SetlistSong>) => {
    if (viewMode === 'repertoire') {
      const target = masterRepertoire.find(s => s.id === songId);
      if (target) syncToMasterRepertoire(user!.id, [{ ...target, ...updates }]).then(fetchMasterRepertoire);
      return;
    }
    if (!currentListId) return;
    const updatedSongs = currentList!.songs.map(s => s.id === songId ? { ...s, ...updates } : s);
    saveList(currentListId, updatedSongs, {}, [updatedSongs.find(s => s.id === songId)!]);
  };

  const handleUpdateKey = (songId: string, newTargetKey: string) => {
    handleUpdateSong(songId, { targetKey: newTargetKey });
  };

  const handleAddToGig = (song: SetlistSong) => {
    if (!currentListId) return;
    const newEntry = { ...song, id: Math.random().toString(36).substr(2, 9), master_id: song.master_id || song.id, isPlayed: false, isApproved: false };
    saveList(currentListId, [...currentList!.songs, newEntry]);
    showSuccess(`Added "${song.name}" to gig`);
  };

  const startPerformance = () => {
    const playable = songs.filter(s => s.isApproved && s.previewUrl && !s.previewUrl.includes('apple.com'));
    if (!playable.length) { showError("No approved tracks found."); return; }
    setIsPerformanceMode(true);
    handleSelectSong(playable[0]);
  };

  const handleSelectSong = async (song: SetlistSong) => {
    setActiveSongId(song.id);
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown");
      transposerRef.current.setPitch(song.pitch);
    }
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      <nav className="h-16 md:h-20 bg-white dark:bg-slate-900 border-b px-4 md:px-6 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-6 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><LayoutDashboard className="w-5 h-5" /></div>
            <span className="font-black uppercase tracking-tighter text-lg hidden sm:block">Gig Studio <span className="text-indigo-600">Pro</span></span>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setViewMode('repertoire')}
              className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all", viewMode === 'repertoire' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-500")}
            >
              <Library className="w-3.5 h-3.5" /> <span className="hidden md:inline">Repertoire</span>
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setViewMode('setlist')}
              className={cn("h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all", viewMode === 'setlist' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600" : "text-slate-500")}
            >
              <ListMusic className="w-3.5 h-3.5" /> <span className="hidden md:inline">Gigs</span>
            </Button>
          </div>

          {viewMode === 'setlist' && (
            <SetlistSelector setlists={setlists} currentId={currentListId || ''} onSelect={setCurrentListId}
              onCreate={async () => {
                const name = prompt("Gig Name:");
                if (name) {
                  const { data } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [] }]).select().single();
                  if (data) { await fetchSetlists(); setCurrentListId(data.id); }
                }
              }}
              onDelete={async (id) => { if(confirm("Delete gig?")) { await supabase.from('setlists').delete().eq('id', id); fetchSetlists(); } }}
            />
          )}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsAuditModalOpen(true)}
            className="hidden sm:flex h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
          >
            <ClipboardCheck className="w-4 h-4" /> Resource Audit
          </Button>
          
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-white/5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-black font-mono text-slate-600">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <Button variant="default" size="sm" onClick={startPerformance} className="h-10 gap-2 bg-indigo-600 font-bold uppercase tracking-tight shadow-lg shadow-indigo-600/20 px-4"><Rocket className="w-4 h-4" /> Start Show</Button>
          <button onClick={() => setIsPreferencesOpen(true)} className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
            <UserIcon className="w-3 h-3 text-slate-500" /><span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest hidden sm:inline">{user?.email?.split('@')[0]}</span>{isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}<Settings className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto space-y-8">
          <ActiveSongBanner song={processedSongs.find(s => s.id === activeSongIdState) || null} onClear={() => setActiveSongId(null)} />
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight uppercase">{viewMode === 'repertoire' ? 'Global Repertoire' : currentList?.name}</h2>
              <p className="text-slate-500 text-xs font-medium mt-1">{songs.length} Tracks Bound to {viewMode === 'repertoire' ? 'Master Library' : 'Gig'}</p>
            </div>
            <div className="flex gap-3">
              {viewMode === 'setlist' && (
                <Button onClick={() => setIsRepertoirePickerOpen(true)} className="bg-indigo-600 h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg">
                  <Library className="w-3.5 h-3.5" /> Add from Repertoire
                </Button>
              )}
              <ImportSetlist onImport={(newSongs) => viewMode === 'repertoire' ? syncToMasterRepertoire(user!.id, newSongs).then(fetchMasterRepertoire) : saveList(currentListId!, [...songs, ...newSongs], {}, newSongs)} />
            </div>
          </div>

          {/* Automation Hub (Only on Repertoire) */}
          {viewMode === 'repertoire' && (
            <SetlistStats songs={songs} goalSeconds={currentList?.time_goal} onUpdateGoal={(s) => saveList(currentListId!, songs, { time_goal: s })} />
          )}

          <SetlistManager 
            songs={processedSongs} 
            currentSongId={activeSongIdState || undefined}
            onSelect={handleSelectSong}
            onEdit={(s) => { setEditingSongId(s.id); setIsStudioModalOpen(true); }}
            onRemove={(id) => viewMode === 'repertoire' ? supabase.from('repertoire').delete().eq('id', id).then(fetchMasterRepertoire) : saveList(currentListId!, songs.filter(s => s.id !== id))}
            onUpdateKey={handleUpdateKey}
            onTogglePlayed={(id) => viewMode === 'setlist' && saveList(currentListId!, songs.map(s => s.id === id ? { ...s, isPlayed: !s.isPlayed } : s))}
            onUpdateSong={handleUpdateSong}
            onSyncProData={() => Promise.resolve()}
            onReorder={(ns) => viewMode === 'setlist' && saveList(currentListId!, ns)}
            sortMode={sortMode} setSortMode={setSortMode}
            activeFilters={activeFilters} setActiveFilters={setActiveFilters}
            searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            onLinkAudio={(n) => { setIsSearchPanelOpen(true); transposerRef.current?.triggerSearch(n); }}
          />
        </div>
        <MadeWithDyad />
      </main>

      <RepertoirePicker isOpen={isRepertoirePickerOpen} onClose={() => setIsRepertoirePickerOpen(false)} repertoire={masterRepertoire} currentSetlistSongs={currentList?.songs || []} onAdd={handleAddToGig} />
      <SongStudioModal isOpen={isStudioModalOpen} onClose={() => setIsStudioModalOpen(false)} gigId={viewMode === 'repertoire' ? 'library' : currentListId} songId={editingSongId} visibleSongs={processedSongs} onSelectSong={setEditingSongId} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      <ResourceAuditModal isOpen={isAuditModalOpen} onClose={() => setIsAuditModalOpen(false)} songs={songs} onVerify={handleUpdateSong} />
      
      {isPerformanceMode && (
        <PerformanceOverlay songs={songs.filter(s => s.isApproved)} currentIndex={songs.findIndex(s => s.id === activeSongIdState)} isPlaying={false} progress={0} duration={0} onTogglePlayback={() => {}} onNext={() => {}} onPrevious={() => {}} onShuffle={() => {}} onClose={() => setIsPerformanceMode(false)} onUpdateSong={handleUpdateSong} onUpdateKey={handleUpdateKey} analyzer={null} />
      )}

      <aside className={cn("w-full md:w-[450px] bg-white dark:bg-slate-900 border-l absolute right-0 top-20 bottom-0 z-40 transition-transform duration-500", isSearchPanelOpen ? "translate-x-0" : "translate-x-full")}>
        <AudioTransposer ref={transposerRef} onAddToSetlist={(u, n, a, yt, ug) => handleUpdateSong(activeSongIdState!, { previewUrl: u, youtubeUrl: yt, ugUrl: ug })} repertoire={masterRepertoire} />
      </aside>
    </div>
  );
};

export default Index;