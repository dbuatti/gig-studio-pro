"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UploadCloud, FileText, Plus, ArrowRight, X, Ruler, Edit3, Trash2, ChevronLeft, ChevronRight, Settings2, Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import LinkEditorOverlay from '@/components/LinkEditorOverlay';
import LinkDisplayOverlay, { SheetLink } from '@/components/LinkDisplayOverlay';
import LinkSizeModal from '@/components/LinkSizeModal';
import { useSettings } from '@/hooks/use-settings';
import { useNavigate } from 'react-router-dom';

// Configure PDF.js worker source
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const DEBUG_PDF_URL_KEY = 'debug_pdf_url';
const DEBUG_SONG_ID_KEY = 'debug_song_id';

const DebugPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { linkSize: globalLinkSize } = useSettings();

  const [testPdfUrl, setTestPdfUrl] = useState<string | null>(() => localStorage.getItem(DEBUG_PDF_URL_KEY));
  const [debugSongId, setDebugSongId] = useState<string | null>(() => localStorage.getItem(DEBUG_SONG_ID_KEY));
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false); // NEW: State for fullscreen mode

  const [links, setLinks] = useState<SheetLink[]>([]);
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [isLinkSizeModalOpen, setIsLinkSizeModalOpen] = useState(false);
  const [isEditingLinksMode, setIsEditingLinksMode] = useState(false);
  const [editingLink, setEditingLink] = useState<SheetLink | null>(null); // For editing existing links

  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null); // Ref for the rendered PDF page div
  const overlayWrapperRef = useRef<HTMLDivElement>(null); // NEW REF for LinkDisplayOverlay's parent
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure a debug song ID exists for link creation
  useEffect(() => {
    const initializeDebugSong = async () => {
      if (!user) return;

      let currentDebugSongId = localStorage.getItem(DEBUG_SONG_ID_KEY);
      let songExistsInDb = false;

      if (currentDebugSongId) {
        // Check if the song exists in the repertoire table
        const { data, error } = await supabase
          .from('repertoire')
          .select('id')
          .eq('id', currentDebugSongId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          songExistsInDb = true;
        } else if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
          console.error("[DebugPage] Error checking debug song existence:", error.message);
          showError("Failed to check debug song existence.");
          currentDebugSongId = null; // Force creation of a new one if DB check fails
        }
      }

      if (!currentDebugSongId || !songExistsInDb) {
        const newId = crypto.randomUUID();
        console.log("[DebugPage] Creating new debug song in repertoire with ID:", newId);
        try {
          const { error: insertError } = await supabase
            .from('repertoire')
            .insert({
              id: newId,
              user_id: user.id,
              title: "Debug Song for Link Testing",
              artist: "Dyad AI",
              original_key: "C",
              target_key: "C",
              pitch: 0,
              bpm: "120",
              genre: "Test",
              is_active: true,
              is_metadata_confirmed: true,
              is_key_confirmed: true,
              lyrics: "This is a dummy song for testing sheet music links.",
              preview_url: "", // No audio needed for link testing
              extraction_status: "completed", // Mark as completed to avoid processing
              is_in_library: false, // Mark as not in main library
            });

          if (insertError) throw insertError;
          currentDebugSongId = newId;
          localStorage.setItem(DEBUG_SONG_ID_KEY, newId);
          showSuccess("Debug song created for linking tests!");
          console.log("[DebugPage] Debug song created with ID:", newId);
        } catch (err: any) {
          console.error("[DebugPage] Failed to create debug song:", err.message);
          showError("Failed to create debug song. Linking might not work.");
          return; // Abort if debug song creation fails
        }
      }
      setDebugSongId(currentDebugSongId);
    };

    if (user) {
      initializeDebugSong();
    }
  }, [user]);

  // Fetch links when PDF URL or song ID changes
  const fetchLinks = useCallback(async () => {
    if (!user || !debugSongId || !testPdfUrl) {
      setLinks([]);
      console.log("[DebugPage] Skipping link fetch: User, song ID, or PDF URL missing.");
      return;
    }
    console.log("[DebugPage] Fetching links for song ID:", debugSongId);
    try {
      const { data, error } = await supabase
        .from('sheet_links')
        .select('*')
        .eq('song_id', debugSongId)
        .eq('user_id', user.id); // Corrected to user.id
      
      if (error) throw error;
      setLinks(data || []);
      console.log("[DebugPage] Links fetched:", data.length);
    } catch (err: any) {
      console.error("[DebugPage] Error fetching links:", err.message);
      showError("Failed to load links.");
    }
  }, [user, debugSongId, testPdfUrl]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showError("Only PDF files are supported.");
      return;
    }

    if (!user) {
      showError("You must be logged in to upload files.");
      return;
    }

    setIsUploading(true);
    setPdfError(null);
    console.log("[DebugPage] Starting PDF upload:", file.name);

    try {
      const fileName = `${user.id}/debug_pdf_${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(fileName, file, {
          upsert: true,
          contentType: 'application/pdf',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('public_audio').getPublicUrl(fileName);
      setTestPdfUrl(publicUrl);
      localStorage.setItem(DEBUG_PDF_URL_KEY, publicUrl);
      showSuccess("PDF uploaded and stored!");
      console.log("[DebugPage] PDF uploaded successfully. URL:", publicUrl);
      setPdfDocument(null); // Force re-render/reload of PDF viewer
      setPdfCurrentPage(1);
      setPdfNumPages(null);
      setPdfScale(1.0);
      fetchLinks(); // Refetch links in case the song ID changed or was just created
    } catch (err: any) {
      console.error("[DebugPage] PDF upload failed:", err.message);
      showError(`PDF upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    console.log("[DebugPage] PDF Document loaded successfully. Pages:", pdf.numPages);
    setPdfDocument(pdf);
    setPdfNumPages(pdf.numPages);
    setIsLoadingPdf(false);
    if (pdfContainerRef.current) {
      calculatePdfScale(pdf, pdfContainerRef.current, pdfCurrentPage);
    }
  }, [pdfCurrentPage]);

  const handleDocumentLoadError = useCallback((error: any) => {
    console.error("[DebugPage] Error loading PDF Document:", error);
    setPdfError("Failed to load PDF. Please check the URL or file.");
    setIsLoadingPdf(false);
  }, []);

  const calculatePdfScale = useCallback(async (pdf: PDFDocumentProxy, container: HTMLDivElement, pageNumber: number) => {
    if (!container || !pdf) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      const scaleX = containerWidth / pageWidth;
      const scaleY = containerHeight / pageHeight;

      setPdfScale(Math.min(scaleX, scaleY));
      console.log("[DebugPage] PDF scale calculated:", Math.min(scaleX, scaleY));
    } catch (error) {
      console.error("[DebugPage] Error calculating PDF scale:", error);
    }
  }, []);

  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || !pdfDocument) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === container) {
          calculatePdfScale(pdfDocument, container, pdfCurrentPage);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
    };
  }, [pdfDocument, pdfCurrentPage, calculatePdfScale]);

  const handleNavigateToPage = useCallback((pageNumber: number, x?: number, y?: number) => {
    setPdfCurrentPage(pageNumber);
    console.log(`[DebugPage] Navigating to page ${pageNumber} with coordinates X:${x}, Y:${y}`);
    // Implement scrolling to specific coordinates if needed, similar to SheetReaderMode
  }, []);

  const handleEditLink = useCallback((link: SheetLink) => {
    setEditingLink(link);
    setIsLinkEditorOpen(true);
    console.log("[DebugPage] Editing link:", link.id);
  }, []);

  const handleClearStoredPdf = () => {
    if (confirm("Are you sure you want to clear the stored PDF URL?")) {
      localStorage.removeItem(DEBUG_PDF_URL_KEY);
      setTestPdfUrl(null);
      setPdfDocument(null);
      setPdfNumPages(null);
      setPdfCurrentPage(1);
      setPdfScale(1.0);
      setPdfError(null);
      setLinks([]);
      showSuccess("Stored PDF cleared.");
      console.log("[DebugPage] Stored PDF URL cleared.");
    }
  };

  const handleClearAllLinks = async () => {
    if (!user || !debugSongId) {
      showError("User or debug song ID missing.");
      return;
    }
    if (!confirm("Are you sure you want to delete ALL links for this debug song?")) return;

    console.log("[DebugPage] Deleting all links for song ID:", debugSongId);
    try {
      const { error } = await supabase.from('sheet_links').delete().eq('song_id', debugSongId).eq('user_id', user.id); // Corrected to user.id
      if (error) throw error;
      showSuccess("All links deleted successfully.");
      setLinks([]);
      console.log("[DebugPage] All links deleted.");
    } catch (err: any) {
      console.error("[DebugPage] Failed to delete all links:", err.message);
      showError(`Failed to delete all links: ${err.message}`);
    }
  };

  // NEW: Fullscreen toggle logic
  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        showError(`Error attempting to enable fullscreen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  // NEW: Listen for fullscreen change events
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  return (
    <div className={cn("flex flex-col", isFullScreen ? "fixed inset-0 z-[100] bg-background" : "min-h-screen p-6 md:p-10")}>
      <div className={cn("flex items-center justify-between mb-8", isFullScreen && "px-6 py-4 bg-card border-b border-border")}>
        <div className="flex items-center gap-4">
          <FileText className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Linking Debug Page</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={toggleFullScreen} 
            className="text-muted-foreground hover:text-foreground gap-2"
            title={isFullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            {isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
        </div>
      </div>

      {!isFullScreen && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* PDF Upload & Info */}
          <div className="lg:col-span-1 bg-card p-6 rounded-[2rem] border border-border shadow-lg space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Test PDF</h2>
            <div className="space-y-4">
              <Label htmlFor="pdf-upload" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> Upload Test PDF
              </Label>
              <div className="flex gap-2">
                <Input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="flex-1 h-10 text-xs bg-secondary border-border text-foreground file:text-foreground file:bg-accent file:border-border file:rounded-md"
                  disabled={isUploading}
                />
                {testPdfUrl && (
                  <Button variant="destructive" size="icon" onClick={handleClearStoredPdf} disabled={isUploading}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {isUploading && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
            </div>

            {testPdfUrl && (
              <div className="space-y-4 pt-4 border-t border-border">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Current PDF
                </Label>
                <p className="text-sm font-mono text-foreground break-all">{testPdfUrl}</p>
                <p className="text-xs text-muted-foreground">Debug Song ID: <span className="font-mono">{debugSongId}</span></p>
                <p className="text-xs text-muted-foreground">Total Links: <span className="font-mono">{links.length}</span></p>
                <Button variant="destructive" onClick={handleClearAllLinks} disabled={links.length === 0}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete All Links
                </Button>
              </div>
            )}
          </div>

          {/* Link Management Controls */}
          <div className="lg:col-span-2 bg-card p-6 rounded-[2rem] border border-border shadow-lg space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Link Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={() => setIsLinkEditorOpen(true)}
                disabled={!testPdfUrl || !pdfDocument}
                className="h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl shadow-lg"
              >
                <Plus className="w-4 h-4" /> Create New Link
              </Button>
              <Button
                onClick={() => setIsEditingLinksMode(prev => !prev)}
                disabled={!testPdfUrl || !pdfDocument || links.length === 0}
                className={cn(
                  "h-14 font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl shadow-lg",
                  isEditingLinksMode ? "bg-red-600 hover:bg-red-700 text-white" : "bg-secondary hover:bg-accent text-foreground"
                )}
              >
                {isEditingLinksMode ? "Exit Edit Mode" : "Edit/Delete Links"}
              </Button>
              <Button
                onClick={() => setIsLinkSizeModalOpen(true)}
                className="h-14 bg-secondary hover:bg-accent text-foreground font-black uppercase tracking-widest text-[10px] gap-2 rounded-xl shadow-lg"
              >
                <Ruler className="w-4 h-4" /> Link Size Settings
              </Button>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> PDF Navigation
              </Label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPdfCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={pdfCurrentPage <= 1}
                  className="h-10 w-10 rounded-xl bg-secondary hover:bg-accent text-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Input
                  type="number"
                  value={pdfCurrentPage}
                  onChange={(e) => setPdfCurrentPage(Math.max(1, Math.min(pdfNumPages || 1, parseInt(e.target.value) || 1)))}
                  className="flex-1 h-10 text-center text-lg font-bold bg-secondary border-border text-foreground"
                />
                <span className="text-lg text-muted-foreground">/ {pdfNumPages || '?'}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPdfCurrentPage(prev => Math.min(prev + 1, pdfNumPages || 1))}
                  disabled={pdfCurrentPage >= (pdfNumPages || 1)}
                  className="h-10 w-10 rounded-xl bg-secondary hover:bg-accent text-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      <div ref={pdfContainerRef} className={cn(
        "flex-1 bg-slate-900 rounded-[2rem] border-4 border-border shadow-2xl overflow-hidden relative flex items-center justify-center",
        isFullScreen ? "rounded-none border-0" : "min-h-[500px]"
      )}>
        {isLoadingPdf && <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />}
        {pdfError && <div className="text-red-400 text-center p-4">{pdfError}</div>}
        {testPdfUrl && !isLoadingPdf && !pdfError && (
          <div className="relative w-full h-full flex items-center justify-center overflow-auto">
            <Document
              file={testPdfUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={<Loader2 className="w-12 h-12 animate-spin text-indigo-500" />}
              className="flex items-center justify-center"
            >
              <Page
                pageNumber={pdfCurrentPage}
                scale={pdfScale}
                renderAnnotationLayer={true}
                renderTextLayer={true}
                loading={<Loader2 className="w-8 h-8 animate-spin text-indigo-400" />}
                // NEW: Pass ref to the rendered page div
                inputRef={pageRef}
              />
            </Document>
            {debugSongId && (
              <div className="absolute inset-0 z-30" ref={overlayWrapperRef}> {/* REMOVED pointer-events-none */}
                <LinkDisplayOverlay
                  links={links}
                  currentPage={pdfCurrentPage}
                  onNavigateToPage={handleNavigateToPage}
                  onLinkDeleted={fetchLinks}
                  isEditingMode={isEditingLinksMode}
                  onEditLink={handleEditLink}
                  pageContainerRef={pageRef} // NEW: Pass the ref
                  pdfScale={pdfScale} // NEW: Pass the scale
                  overlayWrapperRef={overlayWrapperRef} // PASS NEW REF
                />
              </div>
            )}
          </div>
        )}
        {!testPdfUrl && !isLoadingPdf && !pdfError && (
          <div className="text-center text-muted-foreground">
            <UploadCloud className="w-16 h-16 mx-auto mb-4" />
            <p className="text-lg font-bold">Upload a PDF to start debugging links.</p>
          </div>
        )}
      </div>

      {/* Link Editor Modal */}
      {testPdfUrl && pdfDocument && debugSongId && (
        <LinkEditorOverlay
          isOpen={isLinkEditorOpen}
          onClose={() => { setIsLinkEditorOpen(false); setEditingLink(null); }}
          songId={debugSongId}
          chartUrl={testPdfUrl}
          onLinkCreated={fetchLinks}
          editingLink={editingLink} // Pass editingLink for editing functionality
        />
      )}

      {/* Link Size Modal */}
      <LinkSizeModal
        isOpen={isLinkSizeModalOpen}
        onClose={() => setIsLinkSizeModalOpen(false)}
      />
    </div>
  );
};

export default DebugPage;