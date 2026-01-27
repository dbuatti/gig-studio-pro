"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToneAudio } from '@/hooks/use-tone-audio';
import { useSettings } from '@/hooks/use-settings';
import { showSuccess, showInfo, showWarning, showError } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { calculateReadiness, syncToMasterRepertoire } from '@/utils/repertoireSync';
import { DEFAULT_UG_CHORDS_CONFIG } from '@/utils/constants';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Loader2, ListMusic, Settings2, BookOpen, Search, LayoutDashboard, 
  X, AlertCircle, Music, Shuffle, Hash, Library, Plus 
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Custom Components
import SetlistSelector from '@/components/SetlistSelector';
import SetlistManager, { SetlistSong, Setlist } from '@/components/SetlistManager';
import { FilterState, DEFAULT_FILTERS } from '@/components/SetlistFilters';
import SetlistStats from '@/components/SetlistStats';
import RepertoirePicker from '@/components/RepertoirePicker';
import ImportSetlist from '@/components/ImportSetlist';
import ResourceAuditModal from '@/components/ResourceAuditModal';
import SetlistSettingsModal from '@/components/SetlistSettingsModal';
import AdminPanel from '@/components/AdminPanel';
import PreferencesModal from '@/components/PreferencesModal';
import UserGuideModal from '@/components/UserGuideModal';
import SongStudioModal from '@/components/SongStudioModal';
import FloatingCommandDock from '@/components/FloatingCommandDock';
import ActiveSongBanner from '@/components/ActiveSongBanner';
import { StudioTab } from '@/components/SongStudioView';
import RepertoireView from '@/components/RepertoireView';
import KeyManagementModal from '@/components/KeyManagementModal';
import PerformanceOverlay from '@/components/PerformanceOverlay';
import AudioTransposer, { AudioTransposerRef } from '@/components/AudioTransposer';
import GoalTracker from '@/components/GoalTracker';
import SetlistSortModal from '@/components/SetlistSortModal';
import { calculateSemitones } from '@/utils/keyUtils';
import VisuallyHidden from '@/components/VisuallyHidden';

const Index = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const { keyPreference: globalKeyPreference, isFetchingSettings, isGoalTrackerEnabled, defaultDashboardView, preventStageKeyOverwrite } = useSettings();

  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);
  const [masterRepertoire, setMasterRepertoire] = useState<SetlistSong[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(null);
  const [activeSongForPerformance, setActiveSongForPerformance] = useState<SetlistSong | null>(null);
  const [loading, setLoading] = useState(true);
  const [isShuffleAllMode, setIsShuffleAllMode] = useState(false);
  const [floatingDockMenuOpen, setFloatingDockMenuOpen] = useState(false);
  
  const activeDashboardView = (searchParams.get('view') as 'gigs' | 'repertoire') || defaultDashboardView;

  const activeSetlist = useMemo(() => allSetlists.find(l => l.id === activeSetlistId), [allSetlists, activeSetlistId]);

  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(false);
  const [isSongStudioModalOpen, setIsSongStudioModalOpen] = useState(false);
  const [songStudioModalSongId, setSongStudioModalSongId] = useState<string | null>(null);
  const [songStudioModalGigId, setSongStudioModalGigId] = useState<string | 'library' | null>(null);
  const [songStudioDefaultTab, setSongStudioDefaultTab] = useState<StudioTab | undefined>(undefined);
  const [isKeyManagementOpen, setIsKeyManagementOpen] = useState(false);
  const [isPerformanceOverlayOpen, setIsPerformanceOverlayOpen] = useState(false);
  const [isAudioTransposerModalOpen, setIsAudioTransposerModalOpen] = useState(false);
  const [isSetlistSortModalOpen, setIsSetlistSortModalOpen] = useState(false);
  const [isRepertoirePickerOpen, setIsRepertoirePickerOpen] = useState(false);
  const [isResourceAuditOpen, setIsResourceAuditOpen] = useState(false);
  const [isImportSetlistOpen, setIsImportSetlistOpen] = useState(false);
  const [isSetlistSettingsOpen, setIsSetlistSettingsOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('gig_search_term') || "");
  const [sortMode, setSortMode] = useState<'none' | 'ready' | 'work' | 'manual'>(() => (localStorage.getItem('gig_sort_mode') as 'none' | 'ready' | 'work' | 'manual') || 'none');
  const [activeFilters, setActiveFilters] = useState<FilterState>(() => {
    const saved = localStorage.getItem('gig_active_filters');
    try {
      return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  const [showHeatmap, setShowHeatmap] = useState(() => localStorage.getItem('gig_show_heatmap') === 'true');

  const playNextInList = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) return;
    
    if (isShuffleAllMode) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) {
        const currentId = activeSongForPerformance?.master_id || activeSongForPerformance?.id;
        const others = pool.filter(s => (s.master_id || s.id) !== currentId);
        setActiveSongForPerformance(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : pool[0]);
      }
      return;
    }

    const currentIndex = activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    if (currentIndex !== -1 && currentIndex < activeSetlist.songs.length - 1) {
      setActiveSongForPerformance(activeSetlist.songs[currentIndex + 1]);
    } else {
      setActiveSongForPerformance(activeSetlist.songs[0]);
    }
  }, [isShuffleAllMode, activeSetlist, activeSongForPerformance, masterRepertoire]);

  const audio = useToneAudio(true, playNextInList);

  const handleNextSong = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) return;
    const idx = activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const nextIdx = (idx + 1) % activeSetlist.songs.length;
    setActiveSongForPerformance(activeSetlist.songs[nextIdx]);
    showInfo(`Up Next: ${activeSetlist.songs[nextIdx].name}`);
  }, [activeSetlist, activeSongForPerformance]);

  const handlePreviousSong = useCallback(() => {
    if (!activeSetlist || activeSetlist.songs.length === 0) return;
    const idx = activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance?.id);
    const prevIdx = (idx - 1 + activeSetlist.songs.length) % activeSetlist.songs.length;
    setActiveSongForPerformance(activeSetlist.songs[prevIdx]);
    showInfo(`Back to: ${activeSetlist.songs[prevIdx].name}`);
  }, [activeSetlist, activeSongForPerformance]);

  const handleToggleShuffleAll = () => {
    const nextState = !isShuffleAllMode;
    setIsShuffleAllMode(nextState);
    if (nextState) {
      const pool = masterRepertoire.filter(s => !!s.audio_url || !!s.previewUrl);
      if (pool.length > 0) setActiveSongForPerformance(pool[Math.floor(Math.random() * pool.length)]);
    }
  };

  const fetchSetlistsAndRepertoire = useCallback(async (isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoading(true);
    
    try {
      const { data: setlistsData } = await supabase.from('setlists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      const { data: repertoireData } = await supabase.from('repertoire').select('*').eq('user_id', userId).order('title');

      const mappedRepertoire: SetlistSong[] = (repertoireData || []).map(d => ({
        id: d.id, master_id: d.id, name: d.title, artist: d.artist, originalKey: d.original_key || 'TBC',
        targetKey: d.target_key || d.original_key || 'TBC', pitch: d.pitch ?? 0,
        previewUrl: d.extraction_status === 'completed' && d.audio_url ? d.audio_url : d.preview_url,
        youtubeUrl: d.youtube_url, ugUrl: d.ug_url, appleMusicUrl: d.apple_music_url, pdfUrl: d.pdf_url,
        leadsheetUrl: d.leadsheet_url, bpm: d.bpm, genre: d.genre, isMetadataConfirmed: d.is_metadata_confirmed,
        isKeyConfirmed: d.is_key_confirmed, notes: d.notes, lyrics: d.lyrics, resources: d.resources || [],
        user_tags: d.user_tags || [], is_pitch_linked: d.is_pitch_linked ?? true, duration_seconds: d.duration_seconds,
        key_preference: d.key_preference, is_active: d.is_active, fineTune: d.fineTune, tempo: d.tempo, volume: d.volume,
        isApproved: d.is_approved, is_ready_to_sing: d.is_ready_to_sing, preferred_reader: d.preferred_reader, ug_chords_text: d.ug_chords_text,
        ug_chords_config: d.ug_chords_config || DEFAULT_UG_CHORDS_CONFIG, extraction_status: d.extraction_status,
        audio_url: d.audio_url,
        lyrics_updated_at: d.lyrics_updated_at,
        chords_updated_at: d.chords_updated_at,
        ug_link_updated_at: d.ug_link_updated_at,
        highest_note_updated_at: d.highest_note_updated_at,
        original_key_updated_at: d.original_key_updated_at,
        target_key_updated_at: d.target_key_updated_at,
        pdf_updated_at: d.pdf_updated_at,
      }));
      setMasterRepertoire(mappedRepertoire);

      const setlistsWithSongs: Setlist[] = [];
      for (const setlist of setlistsData || []) {
        const { data: junctionData } = await supabase.from('setlist_songs').select('*').eq('setlist_id', setlist.id).order('sort_order', { ascending: true });
        const songs: SetlistSong[] = junctionData?.map(j => {
          const master = mappedRepertoire.find(r => r.id === j.song_id);
          return master ? { ...master, id: j.id, master_id: master.id, isPlayed: j.isPlayed || false } : null;
        }).filter(Boolean) as SetlistSong[] || [];
        setlistsWithSongs.push({ id: setlist.id, name: setlist.name, songs, time_goal: setlist.time_goal });
      }

      setAllSetlists(setlistsWithSongs);
      const savedId = localStorage.getItem('active_setlist_id');
      if (savedId && setlistsWithSongs.some(s => s.id === savedId)) setActiveSetlistId(savedId);
      else setActiveSetlistId(setlistsWithSongs[0]?.id || null);
    } catch (err: any) {
      showError(`Failed to load data: ${err.message}`);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!authLoading && userId) fetchSetlistsAndRepertoire(true);
    else if (!authLoading && !userId) navigate('/landing');
  }, [userId, authLoading, fetchSetlistsAndRepertoire]);

  const handleEditSong = (song: SetlistSong, defaultTab?: StudioTab) => {
    setSongStudioModalSongId(song.master_id || song.id);
    setSongStudioModalGigId(activeDashboardView === 'gigs' ? activeSetlistId : 'library');
    setIsSongStudioModalOpen(true);
    setSongStudioDefaultTab(defaultTab || 'config');
  };

  const filteredAndSortedSongs = useMemo(() => {
    if (!activeSetlist) return [];
    let songs = [...activeSetlist.songs];
    const q = searchTerm.toLowerCase();
    if (q) songs = songs.filter(s => s.name.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));

    if (sortMode === 'ready') songs.sort((a, b) => calculateReadiness(b) - calculateReadiness(a));
    else if (sortMode === 'work') songs.sort((a, b) => calculateReadiness(a) - calculateReadiness(b));
    else if (sortMode === 'none') songs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return songs;
  }, [activeSetlist, searchTerm, sortMode]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Gig Studio Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleToggleShuffleAll} className={cn("h-9 px-4 rounded-xl", isShuffleAllMode ? "bg-indigo-600 text-white" : "text-indigo-600")}>
              <Shuffle className={cn("w-3.5 h-3.5 mr-2", isShuffleAllMode && "animate-spin-slow")} /> Shuffle All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsKeyManagementOpen(true)} className="h-9 px-4 rounded-xl text-indigo-600"><Hash className="w-3.5 h-3.5 mr-2" /> Key Matrix</Button>
            <Button variant="outline" size="sm" onClick={() => setIsPreferencesOpen(true)} className="h-9 px-4 rounded-xl text-indigo-600"><Settings2 className="w-3.5 h-3.5 mr-2" /> Preferences</Button>
          </div>
        </div>

        {isGoalTrackerEnabled && <GoalTracker repertoire={masterRepertoire} onFilterApply={(f) => setActiveFilters(prev => ({...prev, ...f}))} />}

        {activeDashboardView === 'gigs' && activeSongForPerformance && (
          <ActiveSongBanner 
            song={activeSongForPerformance} 
            isPlaying={audio.isPlaying} 
            onTogglePlayback={audio.togglePlayback} 
            onClear={() => { setActiveSongForPerformance(null); audio.stopPlayback(); }} 
            isLoadingAudio={audio.isLoadingAudio}
            nextSongName={activeSetlist?.songs[activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id) + 1]?.name}
            onNext={handleNextSong}
            onPrevious={handlePreviousSong}
          />
        )}

        <Tabs value={activeDashboardView} onValueChange={(v) => setSearchParams({ view: v })} className="w-full mt-8">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-900 p-1 rounded-xl mb-6">
            <TabsTrigger value="gigs" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">Gigs</TabsTrigger>
            <TabsTrigger value="repertoire" className="text-sm font-black uppercase tracking-tight gap-2 h-10 rounded-lg">Repertoire</TabsTrigger>
          </TabsList>

          <TabsContent value="gigs" className="mt-0 space-y-8">
            <SetlistStats songs={activeSetlist?.songs || []} />
            <SetlistManager 
              songs={filteredAndSortedSongs} 
              onSelect={setActiveSongForPerformance} 
              onEdit={handleEditSong} 
              onUpdateKey={(id, k) => audio.setPitch(calculateSemitones(activeSetlist?.songs.find(s => s.id === id)?.originalKey, k))} 
              onLinkAudio={() => {}}
              onSyncProData={async () => {}}
              currentSongId={activeSongForPerformance?.id}
              sortMode={sortMode} setSortMode={setSortMode} activeFilters={activeFilters} setActiveFilters={setActiveFilters} searchTerm={searchTerm} setSearchTerm={setSearchTerm} showHeatmap={showHeatmap} allSetlists={allSetlists}
              onRemove={async (id) => { await supabase.from('setlist_songs').delete().eq('id', id); fetchSetlistsAndRepertoire(); }}
              onUpdateSong={async (id, u) => { await syncToMasterRepertoire(userId!, [{...u, id: activeSetlist?.songs.find(s => s.id === id)?.master_id}]); fetchSetlistsAndRepertoire(); }}
              onTogglePlayed={async (id) => { const s = activeSetlist?.songs.find(x => x.id === id); await supabase.from('setlist_songs').update({ isPlayed: !s?.isPlayed }).eq('id', id); fetchSetlistsAndRepertoire(); }}
              onReorder={async (ns) => { for(let i=0; i<ns.length; i++) await supabase.from('setlist_songs').update({sort_order: i}).eq('id', ns[i].id); fetchSetlistsAndRepertoire(); }}
              onUpdateSetlistSongs={async (sid, s, a) => { if(a==='add') await supabase.from('setlist_songs').insert({setlist_id: sid, song_id: s.master_id, sort_order: 0}); else await supabase.from('setlist_songs').delete().eq('setlist_id', sid).eq('song_id', s.master_id); fetchSetlistsAndRepertoire(); }}
              onOpenSortModal={() => setIsSetlistSortModalOpen(true)}
            />
          </TabsContent>

          <TabsContent value="repertoire" className="mt-0 space-y-8">
            <RepertoireView 
              repertoire={masterRepertoire} onEditSong={handleEditSong} allSetlists={allSetlists} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} 
              searchTerm={searchTerm} setSearchTerm={setSearchTerm} sortMode={sortMode} setSortMode={setSortMode} activeFilters={activeFilters} setActiveFilters={setActiveFilters}
              onUpdateSetlistSongs={async (sid, s, a) => { if(a==='add') await supabase.from('setlist_songs').insert({setlist_id: sid, song_id: s.master_id, sort_order: 0}); else await supabase.from('setlist_songs').delete().eq('setlist_id', sid).eq('song_id', s.master_id); fetchSetlistsAndRepertoire(); }}
              onDeleteSong={async (id) => { await supabase.from('repertoire').delete().eq('id', id); fetchSetlistsAndRepertoire(); }}
              onAddSong={async (s) => { await syncToMasterRepertoire(userId!, [s]); fetchSetlistsAndRepertoire(); }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommandDock 
        onOpenSearch={() => {
          console.log("[Dashboard] Opening Audio Transposer (Search) Modal");
          setIsAudioTransposerModalOpen(true);
        }} 
        onOpenPractice={() => {}} 
        onOpenReader={(id) => {
          sessionStorage.setItem('from_dashboard', 'true');
          navigate(`/sheet-reader/${id || ''}`);
        }} 
        onOpenAdmin={() => setIsAdminPanelOpen(true)} onOpenPreferences={() => setIsPreferencesOpen(true)} onToggleHeatmap={() => setShowHeatmap(!showHeatmap)} 
        onOpenUserGuide={() => setIsUserGuideOpen(true)} showHeatmap={showHeatmap} viewMode={activeDashboardView} hasPlayableSong={!!activeSongForPerformance} isPlaying={audio.isPlaying} 
        onTogglePlayback={audio.togglePlayback} activeSongId={activeSongForPerformance?.id} onSetMenuOpen={setFloatingDockMenuOpen} isMenuOpen={floatingDockMenuOpen} 
        onOpenPerformance={() => setIsPerformanceOverlayOpen(true)} hasReadableChart={!!activeSongForPerformance}
      />

      {isAudioTransposerModalOpen && (
        <AlertDialog open={isAudioTransposerModalOpen} onOpenChange={setIsAudioTransposerModalOpen}>
          <AlertDialogContent className="max-w-[95vw] w-[1200px] h-[90vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl flex flex-col">
            <AlertDialogHeader className="sr-only">
              <VisuallyHidden>
                <AlertDialogTitle>Audio Discovery Matrix</AlertDialogTitle>
              </VisuallyHidden>
            </AlertDialogHeader>
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-slate-900 shrink-0">
               <h3 className="text-xl font-black uppercase text-white">Audio Discovery Matrix</h3>
               <Button variant="ghost" onClick={() => setIsAudioTransposerModalOpen(false)} className="h-10 w-10 p-0 text-slate-400 hover:text-white">
                 <X className="w-6 h-6" />
               </Button>
            </div>
            <div className="flex-1 overflow-hidden">
               <AudioTransposer 
                 repertoire={masterRepertoire}
                 currentSong={activeSongForPerformance}
                 onAddToSetlist={(p, n, a, y, u, am, g, pi, au, es) => {
                   if (activeDashboardView === 'repertoire' || !activeSetlistId) {
                      syncToMasterRepertoire(userId!, [{ name: n, artist: a, previewUrl: p, youtubeUrl: y, ugUrl: u, appleMusicUrl: am, genre: g, pitch: pi, audio_url: au, extraction_status: es }]);
                   } else {
                      onUpdateSetlistSongs?.(activeSetlistId, { id: crypto.randomUUID(), name: n, artist: a, previewUrl: p, youtubeUrl: y, ugUrl: u, appleMusicUrl: am, genre: g, pitch: pi, audio_url: au, extraction_status: es } as any, 'add');
                   }
                   setIsAudioTransposerModalOpen(false);
                   fetchSetlistsAndRepertoire();
                 }}
                 onAddExistingSong={async (s) => {
                   if (activeSetlistId) {
                     await supabase.from('setlist_songs').insert({ setlist_id: activeSetlistId, song_id: s.master_id || s.id, sort_order: 0 });
                     showSuccess(`Added "${s.name}" to gig!`);
                     setIsAudioTransposerModalOpen(false);
                     fetchSetlistsAndRepertoire();
                   }
                 }}
                 currentList={activeSetlist}
               />
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <SongStudioModal 
        isOpen={isSongStudioModalOpen} onClose={() => setIsSongStudioModalOpen(false)} 
        gigId={songStudioModalGigId} songId={songStudioModalSongId} 
        visibleSongs={activeDashboardView === 'gigs' ? filteredAndSortedSongs : masterRepertoire} 
        allSetlists={allSetlists} masterRepertoire={masterRepertoire} defaultTab={songStudioDefaultTab} 
        audioEngine={audio}
      />

      {isPerformanceOverlayOpen && activeSetlist && activeSongForPerformance && (
        <PerformanceOverlay songs={activeSetlist.songs} currentIndex={activeSetlist.songs.findIndex(s => s.id === activeSongForPerformance.id)} isPlaying={audio.isPlaying} progress={audio.progress} duration={audio.duration} onTogglePlayback={audio.togglePlayback} onNext={handleNextSong} onPrevious={handlePreviousSong} onShuffle={() => {}} onClose={() => setIsPerformanceOverlayOpen(false)} onUpdateSong={() => {}} onUpdateKey={() => {}} analyzer={audio.analyzer} gigId={activeSetlist.id} />
      )}
      
      <AdminPanel isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} onRefreshRepertoire={() => fetchSetlistsAndRepertoire()} />
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
    </div>
  );
};

export default Index;