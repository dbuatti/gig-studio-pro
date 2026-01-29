// ... (previous code)
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
          onUpdateSong={async (id, u) => { 
            const songInSet = activeSetlist?.songs.find(s => s.id === id);
            if (songInSet?.master_id) {
              await syncToMasterRepertoire(userId!, [{...u, id: songInSet.master_id}]); 
              fetchSetlistsAndRepertoire(); 
            } else {
              showWarning("Song not yet in master library. Updates ignored for master sync.");
            }
          }}
          onTogglePlayed={async (id) => { const s = activeSetlist?.songs.find(x => x.id === id); await supabase.from('setlist_songs').update({ isPlayed: !s?.isPlayed }).eq('id', id); fetchSetlistsAndRepertoire(); }}
          onReorder={async (ns) => { for(let i=0; i<ns.length; i++) await supabase.from('setlist_songs').update({sort_order: i}).eq('id', ns[i].id); fetchSetlistsAndRepertoire(); }}
          onUpdateSetlistSongs={async (sid, s, a) => { if(a==='add') await supabase.from('setlist_songs').insert({setlist_id: sid, song_id: s.master_id, sort_order: 0}); else await supabase.from('setlist_songs').delete().eq('setlist_id', sid).eq('song_id', s.master_id); fetchSetlistsAndRepertoire(); }}
          onOpenSortModal={() => setIsSetlistSortModalOpen(true)}
        />
      </TabsContent>

      <TabsContent value="repertoire" className="mt-0 space-y-8">
// ... (rest of the file)