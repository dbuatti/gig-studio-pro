"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface PdfViewerProps {
  url: string;
  page: number;
  onLoad: () => void; // This will be called when the *active* iframe is ready
  className?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, page, onLoad, className }) => {
  const iframeARef = useRef<HTMLIFrameElement>(null);
  const iframeBRef = useRef<HTMLIFrameElement>(null);

  const [activeIframe, setActiveIframe] = useState<'A' | 'B'>('A'); // Which iframe is currently visible
  const [loadingPage, setLoadingPage] = useState<number | null>(null); // The page number currently being loaded in the *inactive* iframe
  const [currentBaseUrl, setCurrentBaseUrl] = useState(url); // Track the base URL to detect full URL changes

  // Effect to manage loading and swapping iframes
  useEffect(() => {
    const targetIframeRef = activeIframe === 'A' ? iframeARef : iframeBRef;
    const inactiveIframeRef = activeIframe === 'A' ? iframeBRef : iframeARef;
    const inactiveIframeName = activeIframe === 'A' ? 'B' : 'A';

    // Case 1: The base URL has changed (e.g., switched to a different PDF document)
    if (url !== currentBaseUrl) {
      console.log(`[PdfViewer] Base URL changed from ${currentBaseUrl} to ${url}. Resetting.`);
      setCurrentBaseUrl(url);
      setLoadingPage(page); // Start loading the new page in the primary iframe
      setActiveIframe('A'); // Default to A as the initial active iframe for new URL
      
      if (iframeARef.current) {
        iframeARef.current.src = `${url}#toolbar=0&navpanes=0&view=Fit&page=${page}`;
      }
      if (iframeBRef.current) {
        iframeBRef.current.src = 'about:blank'; // Clear the other iframe
      }
      return; // Exit early, as a full URL change is handled
    }

    // Case 2: Only the page number has changed for the same base URL
    if (page !== loadingPage && page !== (activeIframe === 'A' ? parseInt(iframeARef.current?.contentWindow?.location.hash.split('page=')[1] || '0') : parseInt(iframeBRef.current?.contentWindow?.location.hash.split('page=')[1] || '0'))) {
      console.log(`[PdfViewer] Page changed from ${loadingPage} to ${page}. Loading into inactive iframe ${inactiveIframeName}.`);
      setLoadingPage(page);
      if (inactiveIframeRef.current) {
        inactiveIframeRef.current.src = `${url}#toolbar=0&navpanes=0&view=Fit&page=${page}`;
      }
    }
  }, [url, page, activeIframe, loadingPage, currentBaseUrl]);

  const handleIframeLoad = useCallback((loadedIframeName: 'A' | 'B') => {
    const loadedIframeRef = loadedIframeName === 'A' ? iframeARef : iframeBRef;
    const loadedPageInIframe = parseInt(loadedIframeRef.current?.contentWindow?.location.hash.split('page=')[1] || '0');

    // If the iframe that just loaded is the one we were waiting for (inactive, loading the target page)
    if (loadingPage !== null && loadedIframeName !== activeIframe && loadedPageInIframe === loadingPage) {
      console.log(`[PdfViewer] Inactive iframe ${loadedIframeName} loaded page ${loadingPage}. Swapping to it.`);
      setActiveIframe(loadedIframeName);
      setLoadingPage(null); // Clear the loading state
      onLoad(); // Notify parent that the new active content is ready
    } else if (loadedIframeName === activeIframe && loadingPage === null) {
      // This handles the initial load of the active iframe or if the URL changed and the primary iframe loaded
      console.log(`[PdfViewer] Active iframe ${loadedIframeName} finished initial load or URL change.`);
      onLoad();
    }
  }, [activeIframe, loadingPage, onLoad]);

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      <iframe
        ref={iframeARef}
        className={cn(
          "absolute inset-0 w-full h-full bg-white transition-opacity duration-300",
          activeIframe === 'A' ? 'opacity-100 z-20' : 'opacity-0 z-10'
        )}
        title="PDF Viewer A"
        onLoad={() => handleIframeLoad('A')}
        style={{ border: 'none' }}
      />
      <iframe
        ref={iframeBRef}
        className={cn(
          "absolute inset-0 w-full h-full bg-white transition-opacity duration-300",
          activeIframe === 'B' ? 'opacity-100 z-20' : 'opacity-0 z-10'
        )}
        title="PDF Viewer B"
        onLoad={() => handleIframeLoad('B')}
        style={{ border: 'none' }}
      />
    </div>
  );
};

export default PdfViewer;