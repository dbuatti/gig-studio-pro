"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import AudioTransposer, { AudioTransposerRef } from "@/components/AudioTransposer";
import SetlistManager, { SetlistSong } from "@/components/SetlistManager";
import SetlistSelector from "@/components/SetlistSelector";
import ImportSetlist from "@/components/ImportSetlist";
import PerformanceOverlay from "@/components/PerformanceOverlay";
import ActiveSongBanner from "@/components/ActiveSongBanner";
import SetlistStats from "@/components/SetlistStats";
import PreferencesModal from "@/components/PreferencesModal";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { showSuccess, showError } from '@/utils/toast';
import { calculateSemitones } from '@/utils/keyUtils';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, User as UserIcon, Loader2, Play, Music, LayoutDashboard, Search as SearchIcon, Rocket, Hash, Music2, Settings, Sparkles, RefreshCw, Library, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSettings } from '@/hooks/use-settings';

const Index = () => {
  const { user, signOut } = useAuth();
  const { keyPreference, setKeyPreference } = useSettings();
  const [setlists, setSetlists] = useState<{ id: string; name: string; songs: SetlistSong[]; time_goal?: number }[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [performanceState, setPerformanceState] = useState({ progress: 0, duration: 0 });
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
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

  // Global Audio Resume on first click with passive listener
  useEffect(() => {
    const handleGesture = async () => {
      if (Tone.getContext().state !== 'running') {
        await Tone.start();
        console.log("Gig Studio: Audio Engine Resumed");
      }
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };

    window.addEventListener('click', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  useEffect(() => {
    if (user) fetchSetlists();
    
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(clockInterval);
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
  }, [syncQueue, isProcessingQueue, currentListId, songs]);

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

  const getReadinessScore = (song: SetlistSong) => {
    let score = 0;
    const isItunes = song.previewUrl?.includes('apple.com') || song.previewUrl?.includes('itunes-assets');
    if (song.previewUrl && !isItunes) score += 25;
    if (song.isKeyConfirmed) score += 20;
    if (song.lyrics && song.lyrics.length > 20) score += 15;
    if (song.pdfUrl || song.leadsheetUrl) score += 15;
    if (song.ugUrl) score += 10;
    if (song.bpm) score += 5;
    if (song.notes && song.notes.length > 10) score += 5;
    if (song.artist && song.artist !== "Unknown Artist") score += 5;
    return score;
  };

  const handleBulkRepertoireSync = async () => {
    if (!songs.length || !user) return;
    setIsBulkSyncing(true);
    try {
      const uniqueRepertoireMap = new Map();
      
      songs.forEach(song => {
        const title = song.name;
        const artist = song.artist || 'Unknown Artist';
        const key = `${title}-${artist}`.toLowerCase();
        const score = getReadinessScore(song);
        
        if (!uniqueRepertoireMap.has(key) || score > uniqueRepertoireMap.get(key).readiness_score) {
          uniqueRepertoireMap.set(key, {
            user_id: user.id,
            title,
            artist,
            original_key: song.originalKey || null,
            bpm: song.bpm || null,
            genre: song.genre || (song.user_tags?.[0]) || null,
            readiness_score: score,
            is_active: true
          });
        }
      });

      const finalData = Array.from(uniqueRepertoireMap.values());

      const { error } = await supabase
        .from('repertoire')
        .upsert(finalData, { 
          onConflict: 'user_id,title,artist',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      showSuccess(`Sync Complete: ${finalData.length} unique songs pushed to Master.`);
    } catch (err: any) {
      console.error("Sync Error:", err);
      showError(`Sync failed: ${err.message || 'Server Error'}`);
    } finally {
      setIsBulkSyncing(false);
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
      // Handled
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
              ugUrl: aiResult.ugUrl || s.ugUrl,
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

  const handleSyncAll = () => {
    if (!currentListId || songs.length === 0) return;
    const songsToSync = songs.filter(s => !s.isMetadataConfirmed || !s.bpm || s.originalKey === 'TBC');
    if (songsToSync.length === 0) {
      showSuccess("All songs are already synced and confirmed.");
      return;
    }
    setSyncQueue(prev => [...new Set([...prev, ...songsToSync.map(s => s.id)])]);
    showSuccess(`Queueing ${songsToSync.length} songs for AI metadata enrichment...`);
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

  const handleAddToSetlist = async (previewUrl: string, name: string, artist: string, youtubeUrl?: string, pitch: number = 0, ugUrl?: string) => {
    if (!currentListId) return;
    const newSongId = Math.random().toString(36).substr(2, 9);
    const newSong: SetlistSong = {
      id: newSongId,
      name,
      artist,
      previewUrl,
      youtubeUrl,
      ugUrl,
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
    showSuccess(`Imported "${song.name}"`);
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
      await transposerRef.current.loadFromUrl(song.previewUrl, song.name, song.artist || "Unknown", song.youtubeUrl, song.originalKey, song.ugUrl);
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
      setActiveSongId(null);
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

  const startPerformance = async () => {
    const firstPlayable = songs.find(s => !!s.previewUrl);
    if (!firstPlayable) {
      showError("No audio tracks found.");
      return;
    }
    setIsPerformanceMode(true);
    handleSelectSong(firstPlayable);
    setTimeout(() => transposerRef.current?.togglePlayback(), 1000);
  };

  const handleMainClick = (e: React.MouseEvent) => {
    if (isStudioOpen && (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('main-inner-container'))) {
      setIsStudioOpen(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      <nav className="h-16 bg-white dark:bg-slate-900 border-b px-6 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="font-black uppercase tracking-tighter text-lg text-slate-900 dark:text-white">Gig Studio <span className="text-indigo-600">Pro</span></span>
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
              if (confirm("Delete gig?")) {
                await supabase.from('setlists').delete().eq('id', id);
                fetchSetlists();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-white/5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-black font-mono text-slate-600 dark:text-slate-300">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {syncQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                <span className="text-[10px] font-black text-amber-700 uppercase">AI Queue: {syncQueue.length}</span>
              </div>
            )}
            
            <Button variant="default" size="sm" onClick={startPerformance} className="gap-2 bg-indigo-600 font-bold uppercase tracking-tight shadow-lg shadow-indigo-600/20">
              <Rocket className="w-4 h-4" /> Start Show
            </Button>

            <div className="h-6 w-px bg-slate-200" />

            <Button variant="ghost" size="sm" onClick={() => setIsStudioOpen(!isStudioOpen)} className={cn("gap-2 font-bold uppercase tracking-tight", isStudioOpen && "text-indigo-600")}>
              <SearchIcon className="w-4 h-4" /> Studio
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            
            <button 
              onClick={() => setIsPreferencesOpen(true)}
              className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <UserIcon className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{user?.email?.split('@')[0]}</span>
              {isSaving && <Loader2 className="w-3 h-3 animate-spin text-indigo-500 ml-1" />}
              <Settings className="w-3 h-3 text-slate-400 ml-1" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        <main 
          className="flex-1 overflow-y-auto p-8 relative scroll-smooth cursor-default"
          onClick={handleMainClick}
        >
          <div className="max-w-6xl mx-auto space-y-8 main-inner-container">
            <ActiveSongBanner 
              song={activeSong} 
              isPlaying={isPlayerActive}
              onTogglePlayback={() => transposerRef.current?.togglePlayback()}
              onClear={() => {
                setActiveSongId(null);
                transposerRef.current?.stopPlayback();
              }}
            />
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">{currentList?.name}</h2>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-slate-500 text-sm font-medium">{songs.length} Tracks</p>
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <button 
                    onClick={handleSyncAll}
                    disabled={syncQueue.length > 0}
                    className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-500 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {syncQueue.length > 0 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Enrich Metatada
                  </button>
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <button 
                    onClick={handleBulkRepertoireSync}
                    disabled={isBulkSyncing || !songs.length}
                    className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-500 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isBulkSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Library className="w-3 h-3" />}
                    Push to Public Master
                  </button>
                </div>
              </div>
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

            <SetlistStats songs={songs} goalSeconds={currentList?.time_goal} onUpdateGoal={handleUpdateGoal} />

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
          "w-[450px] bg-white dark:bg-slate-900 border-l shadow-2xl transition-all duration-500 shrink-0 relative",
          isStudioOpen ? "translate-x-0" : "translate-x-full absolute right-0 top-16 bottom-0"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-full text-white animate-pulse">
                  {activeSongId ? <Play className="w-4 h-4 fill-current" /> : <SearchIcon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">{activeSongId ? "Performing" : "Studio Engine"}</h3>
                  <p className="text-sm font-bold truncate max-w-[200px]">{activeSongId ? activeSong?.name : "Link Assets"}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsStudioOpen(false)} className="text-[10px] font-bold uppercase">Hide</Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AudioTransposer 
                ref={transposerRef} 
                onAddToSetlist={handleAddToSetlist} 
                onAddExistingSong={handleAddExistingSong}
                onUpdateSongKey={handleUpdateKey}
                onSongEnded={handleNextSong}
                onPlaybackChange={setIsPlayerActive}
                repertoire={fullRepertoire}
                currentSong={activeSong}
              />
            </div>
          </div>
        </aside>
      </div>

      <PreferencesModal 
        isOpen={isPreferencesOpen} 
        onClose={() => setIsPreferencesOpen(false)} 
      />

      {isPerformanceMode && (
        <PerformanceOverlay 
          songs={songs.filter(s => !!s.previewUrl)}
          currentIndex={songs.filter(s => !!s.previewUrl).findIndex(s => s.id === activeSongId)}
          isPlaying={isPlayerActive}
          progress={performanceState.progress}
          duration={performanceState.duration}
          onTogglePlayback={() => transposerRef.current?.togglePlayback()}
          onNext={handleNextSong}
          onPrevious={handlePreviousSong}
          onClose={() => {
            setIsPerformanceMode(false);
            setActiveSongId(null);
            transposerRef.current?.stopPlayback();
          }}
          onUpdateKey={handleUpdateKey}
          onUpdateSong={handleUpdateSong}
          analyzer={transposerRef.current?.getAnalyzer()}
        />
      )}

      {!isStudioOpen && !isPerformanceMode && (
        <button 
          onClick={() => setIsStudioOpen(true)} 
          className="fixed right-0 top-1/2 -translate-y-1/2 z-[40] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-y border-l border-slate-300 dark:border-slate-700 rounded-l-2xl py-8 px-2 transition-all group flex items-center justify-center shadow-[-4px_0_15px_rgba(0,0,0,0.1)]"
          title="Open Song Studio"
        >
          <Music className="w-5 h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
        </button>
      )}
    </div>
  );
};

export default Index;