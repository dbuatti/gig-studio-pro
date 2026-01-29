const handleUgBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    if (newUrl) {
      const cleanUrl = sanitizeUGUrl(newUrl);
      if (cleanUrl !== newUrl) {
        handleAutoSave({ ugUrl: cleanUrl });
      }
      showSuccess("UG Link Saved");
    }
  };

  const handlePullKey = () => {
    if (!chordsText.trim()) {
      showError("Paste chords first to pull key.");
      return;
    }
    const rawExtractedKey = extractKeyFromChords(chordsText);
    if (rawExtractedKey) {
      const formattedKey = formatKey(rawExtractedKey, resolvedPreference);
      handleAutoSave({ 
        originalKey: formattedKey, 
        targetKey: formattedKey,
        pitch: 0,
        isKeyConfirmed: true,
      });
      showSuccess(`Pulled key: ${formattedKey}`);
    } else {
      showError("Could not extract key from chords.");
    }
  };

  const displayChordColor = config.chordColor === "#000000" ? "#ffffff" : config.chordColor;

  return (
    <div className={cn(
      "flex flex-col gap-6 flex-1",
      isMobile ? "flex-col" : "md:w-1/2"
    )}>
      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Ultimate Guitar Link
        </Label>
        <div className="flex gap-3 mt-3">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={formData.ugUrl || ""}
              onChange={(e) => handleAutoSave({ ugUrl: e.target.value })}
              onBlur={handleUgBlur}
              placeholder="Paste Ultimate Guitar tab URL here..."
              className={cn(
                "w-full bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm",
                formData.ugUrl ? "text-orange-400" : ""
              )}
            />
          </div>
          <Button
            onClick={handleFetchUgChords}
            disabled={isFetchingUg || !formData.ugUrl?.trim()}
            className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase gap-2 rounded-xl"
          >
            {isFetchingUg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Fetch Chords
          </Button>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex-1 flex flex-col">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
          Paste Chords & Lyrics
        </Label>
        <Textarea
          value={chordsText}
          onChange={(e) => setChordsText(e.target.value)}
          placeholder="Paste your chords and lyrics here..."
          className="w-full mt-3 bg-black/40 border border-white/20 rounded-xl p-4 pl-10 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[300px] font-mono text-sm resize-none flex-1"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {chordsText.length} characters
          </span>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {chordsText.split('\n').length} lines
          </span>
        </div>
      </div>
    </div>
  );
};