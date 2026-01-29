@@ -498,13 +498,15 @@
           <div className="flex items-center justify-between text-sm text-slate-400">
             <span>Total Duration: {formatDuration(totalDurationSeconds)}</span>
             {gigId !== 'library' && (
-              <div className="flex items-center gap-2">
+              <div className="flex items-center gap-2 min-w-[150px]">
                 <Label htmlFor="time-goal" className="whitespace-nowrap">Goal: {Math.floor(timeGoal / 60)} min</Label>
                 <Slider
                   id="time-goal"
                   min={15}
                   max={240}
                   step={15}
                   value={[timeGoal / 60]}
                   onValueChange={handleUpdateTimeGoal}
                   className="w-[120px]"
                 />
@@ -524,14 +526,16 @@
           </div>
           <div className="flex items-center gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64 group">
-              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
-              <Input
+              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors z-10" />
+              <Input
                 placeholder="Search repertoire..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
-                className="h-10 pl-9 pr-8 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
+                className="h-10 pl-9 pr-8 text-[11px] font-bold bg-card dark:bg-card border-border dark:border-border rounded-xl focus-visible:ring-indigo-500"
               />
               {searchTerm && (
                 <button 
                   onClick={() => setSearchTerm("")}
                   className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
                 >
                   <X className="w-3.5 h-3.5" />
@@ -543,7 +547,7 @@
             <Button
               onClick={handleAddNewSong}
               className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-indigo-600/20"
             >
               <Plus className="w-3.5 h-3.5" /> New Track
             </Button>
           </div>
@@ -570,7 +574,7 @@
                       key={song.id}
                       draggable
                       onDragStart={(e) => handleDragStart(e, index)}
                       onDragOver={handleDragOver}
                       onDrop={(e) => handleDrop(e, index)}
-                      className="flex items-center justify-between p-3 bg-slate-800 rounded-md shadow-sm border border-slate-700 hover:bg-slate-700 transition-colors cursor-grab"
+                      className="flex items-center justify-between p-3 bg-slate-800 rounded-md shadow-sm border border-slate-700 hover:bg-slate-700 transition-colors cursor-grab active:cursor-grabbing"
                     >
                       <div className="flex-1 min-w-0">
                         <p className="text-white font-medium truncate">{song.name}</p>
@@ -618,7 +622,7 @@
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => {
                           setSongToDelete(song);
                           setIsConfirmDeleteOpen(true);
                         }}
@@ -637,7 +641,7 @@
           <div className="flex flex-col gap-3">
             <div className="flex items-center justify-between">
               <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Repertoire Search</Label>
               <span className="text-[9px] font-mono text-muted-foreground">{filteredMasterRepertoire.length} Matches</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="relative flex-1">
-                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
+                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-indigo-500 transition-colors z-10" />
                 <Input
                   placeholder="Search repertoire..."
-                  className="pl-9 h-10 border-border bg-background text-xs focus-visible:ring-indigo-500 text-foreground"
+                  className="pl-9 h-10 border-border bg-background focus-visible:ring-indigo-500 text-xs text-foreground"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
@@ -650,7 +654,7 @@
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => {
                   const newSongs = [...setlistSongs];
                   const [draggedSong] = newSongs.splice(dragIndex, 1);
                   newSongs.splice(dropIndex, 0, draggedSong);
@@ -664,7 +668,7 @@
                 onClick={() => handleReorderSongs(newSongs)} 
                 disabled={isSaving || JSON.stringify(setlistSongs) === JSON.stringify(newSongs)}
                 className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] rounded-lg gap-2"
               >
                 <Check className="w-3 h-3" /> Apply Order
               </Button>
             </div>