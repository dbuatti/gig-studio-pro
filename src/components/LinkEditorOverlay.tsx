"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, CSSProperties } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Plus, ArrowRight, X, MousePointer2, ZoomIn, Loader2, Check } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { showSuccess, showError } from '@/utils/toast';
import { useSettings } from '@/hooks/use-settings';

interface LinkPoint {
  page: number;
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
}

export interface SheetLink {
  id: string;
  user_id: string;
  song_id: string;
  source_page: number;
  source_x: number; // Normalized 0-1
  source_y: number; // Normalized 0-1
  target_page: number;
  target_x: number; // Normalized 0-1
  target_y: number; // Normalized 0-1
  link_size: 'small' | 'medium' | 'large' | 'extra-large';
  created_at: string;
}

interface LinkEditorOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  songId: string;
  chartUrl: string; // Renamed from pdfUrl
  onLinkCreated: () => void;
  editingLink?: SheetLink | null; // NEW: Optional prop for editing existing links
}

const LinkEditorOverlay: React.FC<LinkEditorOverlayProps> = ({
  isOpen,
  onClose,
  songId,
  chartUrl, // Use chartUrl
  onLinkCreated,
  editingLink, // NEW: Destructure editingLink
}) => {
  const { user } = useAuth();
  const { linkSize: globalLinkSize } = useSettings(); // Get global link size

  const [sourcePoint, setSourcePoint] = useState<LinkPoint | null>(null);
  const [targetPoint, setTargetPoint] = useState<LinkPoint | null>(null);
  const [leftPageNum, setLeftPageNum] = useState(1);
  const [rightPageNum, setRightPageNum] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0); // Scale for rendering PDF pages
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Refs for the wrapper divs of each PDF panel
  const leftPanelWrapperRef = useRef<HTMLDivElement>(null);
  const rightPanelWrapperRef = useRef<HTMLDivElement>(null);
  // Refs for the actual rendered PDF page content divs (from react-pdf's Page component)
  const leftPdfPageContentRef = useRef<HTMLDivElement>(null);
  const rightPdfPageContentRef = useRef<HTMLDivElement>(null);

  // LinkEditorOverlay now manages its own PDFDocumentProxy instance
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);

  // Reset state when modal opens/closes or editingLink changes
  useEffect(() => {
    if (isOpen) {
      if (editingLink) {
        setSourcePoint({ page: editingLink.source_page, x: editingLink.source_x, y: editingLink.source_y });
        setTargetPoint({ page: editingLink.target_page, x: editingLink.target_x, y: editingLink.target_y });
        setLeftPageNum(editingLink.source_page);
        setRightPageNum(editingLink.target_page);
        console.log("[LinkEditorOverlay] Initialized for editing link:", editingLink.id);
      } else {
        setSourcePoint(null);
        setTargetPoint(null);
        setLeftPageNum(1);
        setRightPageNum(1);
        console.log("[LinkEditorOverlay] Initialized for creating new link.");
      }
      setPdfError(null);
    } else {
      // When closing, clear PDF document to free resources
      setPdfDocument(null);
      setPdfNumPages(null);
      setPdfScale(1.0);
    }
  }, [isOpen, editingLink, chartUrl]);

  const calculatePdfScale = useCallback(async (pdf: PDFDocumentProxy, pageNumber: number) => {
    const container = leftPanelWrapperRef.current; // Use one of the panel wrappers as reference
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

      // Choose the smaller scale to ensure the entire page fits within the container
      setPdfScale(Math.min(scaleX, scaleY));
      // console.log("[LinkEditorOverlay] PDF scale calculated:", Math.min(scaleX, scaleY)); // Removed verbose log
    } catch (error) {
      console.error("[LinkEditorOverlay] Error calculating PDF scale:", error);
    }
  }, [leftPanelWrapperRef]);

  // Effect for ResizeObserver on the main PDF container
  useEffect(() => {
    const container = leftPanelWrapperRef.current; // Use one of the panel wrappers as reference
    if (!container || !pdfDocument) return; // Use local pdfDocument here

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === container) {
          calculatePdfScale(pdfDocument, leftPageNum); // Use local pdfDocument and leftPageNum as reference
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
    };
  }, [pdfDocument, leftPageNum, calculatePdfScale, leftPanelWrapperRef]);


  const handleDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    // console.log("[LinkEditorOverlay] PDF loaded successfully:", pdf); // Removed verbose log
    setPdfDocument(pdf); // Set local pdfDocument
    setPdfNumPages(pdf.numPages);
    calculatePdfScale(pdf, 1); // Calculate scale for the first page
  }, [calculatePdfScale]);

  const handleDocumentLoadError = useCallback((error: any) => {
    console.error("[LinkEditorOverlay] Error loading PDF:", error);
    setPdfError("Failed to load PDF. Please check the URL or file.");
  }, []);

  const handleTap = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    type: 'source' | 'target',
    pageNumber: number,
    pdfPageContentRef: React.RefObject<HTMLDivElement> // Use this ref for tap coordinates
  ) => {
    if (!pdfPageContentRef.current) return; // Use the content ref

    const rect = pdfPageContentRef.current.getBoundingClientRect(); // Get rect of the actual PDF content
    const x = (e.clientX - rect.left) / rect.width; // Normalized X (0-1)
    const y = (e.clientY - rect.top) / rect.height; // Normalized Y (0-1)

    const newPoint = { page: pageNumber, x, y };

    if (type === 'source') {
      setSourcePoint(newPoint);
      console.log("[LinkEditorOverlay] Source point set:", newPoint);
    } else {
      setTargetPoint(newPoint);
      console.log("[LinkEditorOverlay] Target point set:", newPoint);
    }
  }, []);

  const handleSaveLink = async () => {
    if (!user || !songId || !sourcePoint || !targetPoint) {
      showError("Both source and target points are required.");
      return;
    }

    setIsCreatingLink(true);
    try {
      if (editingLink) {
        // Update existing link
        const { error } = await supabase.from('sheet_links').update({
          source_page: sourcePoint.page,
          source_x: sourcePoint.x,
          source_y: sourcePoint.y,
          target_page: targetPoint.page,
          target_x: targetPoint.x,
          target_y: targetPoint.y,
          link_size: globalLinkSize,
        }).eq('id', editingLink.id).eq('user_id', user.id); // Corrected to user.id
        if (error) throw error;
        showSuccess("Link updated successfully!");
        console.log("[LinkEditorOverlay] Link updated:", editingLink.id);
      } else {
        // Create new link
        const { error } = await supabase.from('sheet_links').insert({
          user_id: user.id,
          song_id: songId,
          source_page: sourcePoint.page,
          source_x: sourcePoint.x,
          source_y: sourcePoint.y,
          target_page: targetPoint.page,
          target_x: targetPoint.x,
          target_y: targetPoint.y,
          link_size: globalLinkSize,
        });
        if (error) throw error;
        showSuccess("Link created successfully!");
        console.log("[LinkEditorOverlay] New link created for song ID:", songId);
      }
      onLinkCreated();
      onClose();
    } catch (err: any) {
      console.error("[LinkEditorOverlay] Failed to save link:", err.message);
      showError(`Failed to save link: ${err.message}`);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const getLinkDotStyle = useCallback((point: LinkPoint | null, type: 'source' | 'target', currentPage: number): CSSProperties => {
    if (!point || point.page !== currentPage) {
      // Return a minimal, valid CSSProperties object if no point, or point is on a different page
      return { display: 'none' }; 
    }

    const pdfPageContentElement = (type === 'source' ? leftPdfPageContentRef.current : rightPdfPageContentRef.current);
    const parentWrapperElement = (type === 'source' ? leftPanelWrapperRef.current : rightPanelWrapperRef.current); // The direct parent of the dot

    if (!pdfPageContentElement || !parentWrapperElement) return { display: 'none' };

    const pdfPageContentRect = pdfPageContentElement.getBoundingClientRect();
    const parentWrapperRect = parentWrapperElement.getBoundingClientRect();

    // Calculate the pixel position of the point relative to the viewport
    const absX = pdfPageContentRect.left + point.x * pdfPageContentRect.width;
    const absY = pdfPageContentRect.top + point.y * pdfPageContentRect.height;

    // Calculate the pixel position of the dot relative to its direct parent (parentWrapperElement)
    const dotLeftPx = absX - parentWrapperRect.left;
    const dotTopPx = absY - parentWrapperRect.top;

    // Convert to percentage relative to the parentWrapperElement's dimensions
    const dotLeftPct = (dotLeftPx / parentWrapperRect.width) * 100;
    const dotTopPct = (dotTopPx / parentWrapperRect.height) * 100;

    const baseSize = {
      'small': 16,
      'medium': 24,
      'large': 32,
      'extra-large': 40,
    }[globalLinkSize];

    return {
      position: 'absolute',
      left: `${dotLeftPct}%`,
      top: `${dotTopPct}%`,
      width: `${baseSize}px`,
      height: `${baseSize}px`,
      borderRadius: '50%',
      backgroundColor: type === 'source' ? 'rgba(79, 70, 229, 0.8)' : 'rgba(234, 88, 12, 0.8)', // indigo-600 / orange-600
      border: `2px solid ${type === 'source' ? 'rgba(79, 70, 229, 1)' : 'rgba(234, 88, 12, 1)'}`,
      transform: 'translate(-50%, -50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '10px',
      fontWeight: 'bold',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      cursor: 'pointer',
    };
  }, [globalLinkSize, leftPdfPageContentRef, rightPdfPageContentRef, leftPanelWrapperRef, rightPanelWrapperRef]); // Add all relevant refs to dependencies

  const renderPdfPanel = (
    type: 'source' | 'target',
    pageNumber: number,
    setPageNumber: React.Dispatch<React.SetStateAction<number>>,
    point: LinkPoint | null,
    wrapperRef: React.RefObject<HTMLDivElement>, // The wrapper div for the panel
    pdfPageContentRef: React.RefObject<HTMLDivElement> // The actual PDF page content div
  ) => (
    <div ref={wrapperRef} className="flex flex-col flex-1 h-full bg-slate-900 rounded-2xl border border-white/10 overflow-hidden relative"> {/* Add relative here */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 shrink-0">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <MousePointer2 className="w-3 h-3" /> {type === 'source' ? 'Source (Blue)' : 'Target (Orange)'}
        </Label>
        <span className="text-[9px] font-mono text-slate-400 uppercase">Page {pageNumber} / {pdfNumPages || '?'}</span>
      </div>
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {pdfError ? (
          <div className="text-red-400 text-center p-4">{pdfError}</div>
        ) : !chartUrl ? (
          <div className="text-slate-500 text-sm italic">No chart available.</div>
        ) : (
          <div
            className="relative w-full h-full flex items-center justify-center overflow-auto"
            onClick={(e) => handleTap(e, type, pageNumber, pdfPageContentRef)} // Pass pdfPageContentRef
          >
            <Document
              file={chartUrl} // Use chartUrl here
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading={<Loader2 className="w-12 h-12 animate-spin text-indigo-500" />}
              className="flex items-center justify-center"
            >
              {pdfDocument && ( // Render Page only if pdfDocument is loaded
                <Page
                  pageNumber={pageNumber}
                  scale={pdfScale}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  loading={<Loader2 className="w-8 h-8 animate-spin text-indigo-400" />}
                  inputRef={pdfPageContentRef} // ASSIGN REF HERE
                />
              )}
            </Document>
            {point && point.page === pageNumber && (
              <div style={getLinkDotStyle(point, type, pageNumber)} />
            )}
          </div>
        )}
      </div>
      <div className="p-3 border-t border-white/10 shrink-0">
        <Slider
          value={[pageNumber]}
          min={1}
          max={pdfNumPages || 1}
          step={1}
          onValueChange={([v]) => setPageNumber(v)}
          className="w-full"
          disabled={!pdfNumPages}
        />
        {point && point.page === pageNumber && (
          <p className="text-[9px] font-mono text-slate-500 mt-2 text-center">
            X: {(point.x * 100).toFixed(1)}%, Y: {(point.y * 100).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-slate-950 border-white/10 overflow-hidden rounded-[2rem] shadow-2xl flex flex-col">
        <DialogHeader className="p-6 bg-indigo-600 shrink-0 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white">
              {editingLink ? "Edit Link" : "Create New Link"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-indigo-100 font-medium">
            Tap on the left page for the blue source, and on the right for the orange target.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 p-6 overflow-hidden">
          {renderPdfPanel('source', leftPageNum, setLeftPageNum, sourcePoint, leftPanelWrapperRef, leftPdfPageContentRef)}
          {renderPdfPanel('target', rightPageNum, setRightPageNum, targetPoint, rightPanelWrapperRef, rightPdfPageContentRef)}
        </div>

        <DialogFooter className="p-6 border-t border-white/5 bg-slate-900 flex flex-col sm:flex-row gap-4">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-black uppercase tracking-widest text-xs h-12 rounded-xl text-slate-400 hover:bg-white/10">
            Cancel
          </Button>
          <Button
            onClick={handleSaveLink}
            disabled={isCreatingLink || !sourcePoint || !targetPoint}
            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-xs h-12 rounded-xl shadow-xl shadow-indigo-500/20 gap-3"
          >
            {isCreatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editingLink ? "Save Changes" : "Create Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkEditorOverlay;