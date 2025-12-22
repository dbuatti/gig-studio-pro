"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import PerformanceOverlay from "@/components/PerformanceOverlay";
import ActiveSongBanner from "@/components/ActiveSongBanner";
import SetlistStats from "@/components/SetlistStats";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon, Loader2, Play, Music, LayoutDashboard, Search as SearchIcon, Rocket } from 'lucide-react';
import { cn } from "@/lib/utils";

const Index = () => {
  const { user, signOut } = useAuth();
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[]; time_goal?: number }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(true);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [performanceState, setPerformanceState] = useState({ progress: 0, duration: 0 });
  
  const [syncQueue, setSyncQueue] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const transposerRef = useRef<AudioTransposerRef>(null);

  const currentList = setlists.find(l => l.id === currentListId);
  const songs = currentList?.songs || [];
  const activeSongIndex = songs.findIndex(s => s.id === activeSongId);
  const activeSong = songs[activeSongIndex] || null;

  const fullRepertoire = useMemo(() => {
    const all = setlists.flatMap(list => list.songs);
    const seen = new Set();
    return all.filter(song => {
      const key = `${song.name}-${song.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [setlists]);

  useEffect(() => {
    if (user) fetchSetlists();
  }, [user]);

  useEffect(() => {
    let interval: number;
    if (isPerformanceMode) {
      interval = window.setInterval(() => {
        if (transposerRef.current) {
          setPerformanceState(transposerRef.current.getProgress());
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPerformanceMode]);

  useEffect(() => {
    if (syncQueue.length === 0 || isProcessingQueue || !currentListId) return;

    const processNextBatch = async () => {
      setIsProcessingQueue(true);
      const batchIds = syncQueue.slice(0, 5);
      const batchSongs = songs.filter(s => batchIds.includes(s.id));

      if (batchSongs.length > 0) {
        await handleBulkSync(batchSongs, true);
        await new Promise(resolve => setTimeout(resolve, 6000));
      }

      setSyncQueue(prev => prev.filter(id => !batchIds.includes(id)));
      setIsProcessingQueue(false);
    };

    processNextBatch();
  }, [syncQueue, isProcessingQueue, currentListId]);

  const fetchSetlists = async () => {
    try {
      const { data, error } = await supabase
        .from('setlists')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setSetlists(data.map(d => ({ 
          id: d.id, 
          name: d.name, 
          songs: d.songs as SetlistSong[],
          time_goal: d.time_goal 
        })));
        setCurrentListId(data[0].id);
      } else {
        const newList = { name: "My First Gig", songs: [], time_goal: 7200 };
        const { data: created, error: createError } = await supabase
          .from('setlists')
          .insert([{ user_id: user?.id, ...newList }])
          .select()
          .single();
        
        if (createError) throw createError;
        if (created) {
          setSetlists([{ id: created.id, name: created.name, songs: created.songs as SetlistSong[], time_goal: created.time_goal }]);
          setCurrentListId(created.id);
        }
      }
    } catch (err) {
      console.error("Fetch error", err);
    }
  };

  const saveList = async (listId: string, updatedSongs: SetlistSong[], updates: Partial<any> = {}) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const cleanedSongs = updatedSongs.map(({ isSyncing, ...rest }) => rest);
      const { error } = await supabase
        .from('setlists')
        .update({ 
          songs: cleanedSongs, 
          updated_at: new Date().toISOString(),
          ...updates
        })
        .eq('id', listId);
      if (error) throw error;
    } catch (err) {
      // Handled silently
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGoal = async (seconds: number) => {
    if (!currentListId) return;
    setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, time_goal: seconds } : l));
    await saveList(currentListId, songs, { time_goal: seconds });
    showSuccess(`Gig goal updated to ${seconds / 3600} hours`);
  };

  const handleBulkSync = async (songsToSync: SetlistSong[], fromQueue = false) => {
    if (!currentListId || songsToSync.length === 0) return;

    if (!fromQueue) {
      setSyncQueue(prev => [...new Set([...prev, ...songsToSync.map(s => s.id)])]);
      return;
    }

    setSetlists(prev => prev.map(l => l.id === currentListId ? {
      ...l,
      songs: l.songs.map(s => 
        songsToSync.find(ts => ts.id === s.id) ? { ...s, isSyncing: true } : s
      )
    } : l));

    try {
      const { data, error } = await supabase.functions.invoke('enrich-metadata', {
        body: { queries: songsToSync.map(s => s.name) }
      });

      if (error) throw error;

      setSetlists(prev => {
        const list = prev.find(l => l.id === currentListId);
        if (!list) return prev;

        const updatedSongs = list.songs.map(s => {
          const aiResult = Array.isArray(data) ? data.find((r: any) => 
            r.name.toLowerCase().includes(s.name.toLowerCase()) || 
            s.name.toLowerCase().includes(r.name.toLowerCase())
          ) : null;

          if (aiResult) {
            return {
              ...s,
              name: aiResult.name || s.name,
              artist: aiResult.artist,
              originalKey: aiResult.originalKey,
              targetKey: aiResult.originalKey,
              bpm: aiResult.bpm?.toString(),
              genre: aiResult.genre,
              ugUrl: aiResult.ugUrl, // New: Suggest UG URL
              isMetadataConfirmed: true,
              pitch: 0,
              isSyncing: false
            };
          }
          return songsToSync.find(ts => ts.id === s.id) ? { ...s, isSyncing: false } : s;
        });

        saveList(currentListId, updatedSongs);
        return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
      });
    } catch (err) {
      setSetlists(prev => prev.map(l => l.id === currentListId ? {
        ...l,
        songs: l.songs.map(s => 
          songsToSync.find(ts => ts.id === s.id) ? { ...s, isSyncing: false } : s
        )
      } : l));
    }
  };

  const handleUpdateSong = (songId: string, updates: Partial<SetlistSong>) => {
    if (!currentListId) return;
    setSetlists(prev => {
      const list = prev.find(l => l.id === currentListId);
      if (!list) return prev;
      const updatedSongs = list.songs.map(s => s.id === songId ? { ...s, ...updates } : s);
      saveList(currentListId, updatedSongs);
      return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
    });
  };

  const handleAddToSetlist = async (previewUrl: string, name: string, artist: string, youtubeUrl?: string, pitch: number = 0) => {
    if (!currentListId) return;
    const newSongId = Math.random().toString(36).substr(2, 9);
    const newSong: SetlistSong = {
      id: newSongId,
      name,
      artist,
      previewUrl,
      youtubeUrl,
      pitch,
      originalKey: "TBC",
      targetKey: "TBC",
      isPlayed: false,
      isSyncing: true,
      isMetadataConfirmed: false
    };
    
    setSetlists(prev => {
      const list = prev.find(l => l.id === currentListId);
      if (!list) return prev;
      const updatedSongs = [...list.songs, newSong];
      saveList(currentListId, updatedSongs);
      return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
    });
    
    setSyncQueue(prev => [...prev, newSongId]);
  };

  const handleAddExistingSong = (song: SetlistSong) => {
    if (!currentListId) return;
    const newSongId = Math.random().toString(36).substr(2, 9);
    const clonedSong: SetlistSong = {
      ...song,
      id: newSongId,
      isPlayed: false 
    };
    
    setSetlists(prev => {
      const list = prev.find(l => l.id === currentListId);
      if (!list) return prev;
      const updatedSongs = [...list.songs, clonedSong];
      saveList(currentListId, updatedSongs);
      return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
    });
    showSuccess(`Imported "${song.name}" to gig.`);
  };

  const handleUpdateKey = (songId: string, targetKey: string) => {
    if (!currentListId) return;
    setSetlists(prev => {
      const list = prev.find(l => l.id === currentListId);
      if (!list) return prev;
      
      const updatedSongs = list.songs.map(s => {
        if (s.id === songId) {
          const pitch = calculateSemitones(s.originalKey || "C", targetKey);
          if (activeSongId === songId && transposerRef.current) transposerRef.current.setPitch(pitch);
          return { ...s, targetKey, pitch };
        }
        return s;
      });
      
      saveList(currentListId, updatedSongs);
      return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
    });
  };

  const handleTogglePlayed = (songId: string) => {
    if (!currentListId) return;
    setSetlists(prev => {
      const list = prev.find(l => l.id === currentListId);
      if (!list) return prev;
      const updatedSongs = list.songs.map(s => s.id === songId ? { ...s, isPlayed: !s.isPlayed } : s);
      saveList(currentListId, updatedSongs);
      return prev.map(l => l.id === currentListId ? { ...l, songs: updatedSongs } : l);
    });
  };

  const handleSelectSong = async (song: SetlistSong) => {
    setActiveSongId(song.id);
    setIsStudioOpen(true);
    if (song.previewUrl && transposerRef.current) {
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown", song.youtubeUrl, song.originalKey);
      transposerRef.current.setPitch(song.pitch);
    }
  };

  const handleNextSong = async () => {
    if (!currentList) return;
    const nextIndex = songs.findIndex((s, i) => i > activeSongIndex && !!s.previewUrl);
    if (nextIndex !== -1) {
      const song = songs[nextIndex];
      handleSelectSong(song);
      if (isPerformanceMode) {
        setTimeout(() => transposerRef.current?.togglePlayback(), 1000);
      }
    } else {
      setIsPerformanceMode(false);
      showSuccess("Gig Finished!");
    }
  };

  const handlePreviousSong = () => {
    if (!currentList) return;
    let prevIndex = -1;
    for (let i = activeSongIndex - 1; i >= 0; i--) {
      if (songs[i].previewUrl) {
        prevIndex = i;
        break;
      }
    }
    if (prevIndex !== -1) {
      handleSelectSong(songs[prevIndex]);
    }
  };

  const startPerformance = () => {
    const firstPlayable = songs.find(s => !!s.previewUrl);
    if (!firstPlayable) {
      showError("No audio tracks found in setlist.");
      return;
    }
    setIsPerformanceMode(true);
    handleSelectSong(firstPlayable);
    setTimeout(() => transposerRef.current?.togglePlayback(), 1000);
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      <nav className="h-16 bg-white dark:bg-slate-900 border-b px-6 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="font-black uppercase tracking-tighter text-lg">Gig Studio <span className="text-indigo-600">Pro</span></span>
          </div>
          <SetlistSelector 
            setlists={setlists} 
            currentId={currentListId || ''} 
            onSelect={setCurrentListId}
            onCreate={async () => {
              const name = prompt("Enter Gig Name:");
              if (!name) return;
              const { data } = await supabase.from('setlists').insert([{ user_id: user?.id, name, songs: [], time_goal: 7200 }]).select().single();
              if (data) fetchSetlists();
            }}
            onDelete={async (id) => {
              if (confirm("Delete this gig?")) {
                await supabase.from('setlists').delete().eq('id', id);
                fetchSetlists();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-4">
          {syncQueue.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
              <span className="text-[10px] font-black text-amber-700 uppercase">AI Processing Queue: {syncQueue.length}</span>
            </div>
          )}
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={startPerformance}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold uppercase tracking-tight"
          >
            <Rocket className="w-4 h-4" /> Start Show
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsStudioOpen(!isStudioOpen)}
            className={cn("gap-2 font-bold uppercase tracking-tight", isStudioOpen && "text-indigo-600")}
          >
            <SearchIcon className="w-4 h-4" /> Song Studio
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
            <UserIcon className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{user?.email?.split('@')[0]}</span>
            {isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full">
            <LogOut className="w-4 h-4 text-slate-400 hover:text-red-500" />
          </Button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8">
            <ActiveSongBanner song={activeSong} />
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">{currentList?.name}</h2>
                <p className="text-slate-500 text-sm font-medium">{songs.length} Songs Loaded</p>
              </div>
              <div className="flex gap-2">
                <ImportSetlist onImport={(newSongs) => {
                  if (!currentListId) return;
                  const songsWithSyncState = newSongs.map(s => ({ ...s, isSyncing: true, isMetadataConfirmed: false }));
                  setSetlists(prev => {
                    const list = prev.find(l => l.id === currentListId);
                    if (!list) return prev;
                    const updated = [...list.songs, ...songsWithSyncState];
                    saveList(currentListId, updated);
                    return prev.map(l => l.id === currentListId ? { ...l, songs: updated } : l);
                  });
                  setSyncQueue(prev => [...prev, ...songsWithSyncState.map(s => s.id)]);
                }} />
              </div>
            </div>

            <SetlistStats 
              songs={songs} 
              goalSeconds={currentList?.time_goal} 
              onUpdateGoal={handleUpdateGoal} 
            />

            <SetlistManager 
              songs={songs} 
              onRemove={(id) => {
                setSetlists(prev => {
                  const list = prev.find(l => l.id === currentListId);
                  if (!list) return prev;
                  const updated = list.songs.filter(s => s.id !== id);
                  saveList(currentListId!, updated);
                  return prev.map(l => l.id === currentListId ? { ...l, songs: updated } : l);
                });
              }}
              onSelect={handleSelectSong}
              onUpdateKey={handleUpdateKey}
              onTogglePlayed={handleTogglePlayed}
              onSyncProData={async (song) => {
                setSyncQueue(prev => [...new Set([...prev, song.id])]);
              }}
              onLinkAudio={(name) => {
                setIsStudioOpen(true);
                transposerRef.current?.triggerSearch(name);
              }}
              onUpdateSong={handleUpdateSong}
              onReorder={(newSongs) => {
                if (!currentListId) return;
                setSetlists(prev => prev.map(l => l.id === currentListId ? { ...l, songs: newSongs } : l));
                saveList(currentListId, newSongs);
              }}
              currentSongId={activeSongId || undefined}
            />
          </div>
          <MadeWithDyad />
        </main>

        <aside className={cn(
          "w-[450px] bg-white dark:bg-slate-900 border-l shadow-2xl transition-all duration-500 ease-in-out shrink-0",
          isStudioOpen ? "translate-x-0" : "translate-x-full absolute right-0 top-16 bottom-0"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full text-white animate-pulse">
                  {activeSongId ? <Play className="w-4 h-4 fill-current" /> : <SearchIcon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">{activeSongId ? "Performing Now" : "Inspiration Studio"}</h3>
                  <p className="text-sm font-bold truncate max-w-[200px]">{activeSongId ? activeSong?.name : "Find & Add Songs"}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsStudioOpen(false)} className="text-[10px] font-bold uppercase tracking-tighter">Close Studio</Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AudioTransposer 
                ref={transposerRef} 
                onAddToSetlist={handleAddToSetlist} 
                onAddExistingSong={handleAddExistingSong}
                onUpdateSongKey={handleUpdateKey}
                onSongEnded={handleNextSong}
                repertoire={fullRepertoire}
                currentSong={activeSong}
              />
            </div>
          </div>
        </aside>
      </div>

      {isPerformanceMode && (
        <PerformanceOverlay 
          songs={songs.filter(s => !!s.previewUrl)}
          currentIndex={songs.filter(s => !!s.previewUrl).findIndex(s => s.id === activeSongId)}
          isPlaying={transposerRef.current?.getIsPlaying() || false}
          progress={performanceState.progress}
          duration={performanceState.duration}
          onTogglePlayback={() => transposerRef.current?.togglePlayback()}
          onNext={handleNextSong}
          onPrevious={handlePreviousSong}
          onClose={() => setIsPerformanceMode(false)}
          onUpdateKey={handleUpdateKey}
          onUpdateSong={handleUpdateSong}
          analyzer={transposerRef.current?.getAnalyzer()}
        />
      )}

      {!isStudioOpen && !isPerformanceMode && (
        <button 
          onClick={() => setIsStudioOpen(true)}
          className="fixed bottom-8 right-8 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-50 group"
        >
          <SearchIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Index;