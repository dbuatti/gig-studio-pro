// ... (Existing imports)

const StudioTabConfig = {
  config: { label: 'Config', icon: 'Settings2' },
  audio: { label: 'Audio', icon: 'Volume2' },
  details: { label: 'Details', icon: 'FileText' },
  charts: { label: 'Charts', icon: 'Guitar' },
  lyrics: { label: 'Lyrics', icon: 'AlignLeft' },
  visual: { label: 'Visual', icon: 'Youtube' },
  library: { label: 'Library', icon: 'Library' },
};

interface SongStudioViewProps {
  gigId: string | 'library';
  songId: string;
  onClose: () => void;
  isModal?: boolean;
  onExpand?: () => void;
  visibleSongs?: SetlistSong[];
  onSelectSong?: (id: string) => void;
  allSetlists?: { id: string; name: string; songs: SetlistSong[] }[];
  masterRepertoire?: SetlistSong[];
  onUpdateSetlistSongs?: (setlistId: string, song: SetlistSong, action: 'add' | 'remove') => Promise<void>;
}

const SongStudioView: React.FC<SongStudioViewProps> = ({
  gigId,
  songId,
  onClose,
  isModal,
  onExpand,
  visibleSongs = [],
  onSelectSong,
  allSetlists = [],
  masterRepertoire = [],
  onUpdateSetlistSongs
}) => {
  // ... (Existing state and hooks)

  // NEW: State for PDF scroll speed (default 1.0)
  const [pdfScrollSpeed, setPdfScrollSpeed] = useState(1.0);

  // ... (Existing handleAutoSave, harmonicSync, fetchData, etc.)

  // ... (Existing JSX)

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* ... (Header and Warning) ... */}
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          {/* ... (Nav) ... */}
          
          <div className="flex-1 overflow-y-auto p-6 relative custom-scrollbar">
            <StudioTabContent
              activeTab={activeTab}
              song={song}
              formData={formData}
              handleAutoSave={handleAutoSave}
              onUpdateKey={setTargetKey}
              audioEngine={audio}
              isMobile={isMobile}
              onLoadAudioFromUrl={audio.loadFromUrl}
              setPreviewPdfUrl={() => {}}
              isFramable={() => true}
              activeChartType={activeChartType}
              setActiveChartType={setActiveChartType}
              handleUgPrint={() => {}}
              handleDownloadAll={async () => {}}
              onSwitchTab={setActiveTab}
              pitch={pitch}
              setPitch={(p) => { setPitch(p); audio.setPitch(p); }}
              targetKey={targetKey}
              setTargetKey={setTargetKey}
              isPitchLinked={isPitchLinked}
              setIsPitchLinked={(linked) => { 
                setIsPitchLinked(linked); 
                if (!linked) audio.setPitch(0); 
              }}
              setTempo={audio.setTempo}
              setVolume={audio.setVolume}
              setFineTune={audio.setFineTune}
              currentBuffer={audio.currentBuffer}
              isPlaying={audio.isPlaying}
              progress={audio.progress}
              duration={audio.duration}
              togglePlayback={audio.togglePlayback}
              stopPlayback={audio.stopPlayback}
              // NEW: Pass PDF scroll props
              pdfScrollSpeed={pdfScrollSpeed}
              setPdfScrollSpeed={setPdfScrollSpeed}
              // NEW: Pass Chord scroll props
              chordAutoScrollEnabled={chordAutoScrollEnabled}
              setChordAutoScrollEnabled={setChordAutoScrollEnabled}
              chordScrollSpeed={chordScrollSpeed}
              setChordScrollSpeed={setChordScrollSpeed}
            />
          </div>
        </div>
      </div>
      
      {/* ... (Modals) ... */}
    </div>
  );
};

export default SongStudioView;