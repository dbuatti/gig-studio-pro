"use client";

import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PdfViewerProps {
  url: string;
  page: number;
  onLoad: () => void;
  className?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, page, onLoad, className }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const newSrc = `${url}#toolbar=0&navpanes=0&view=Fit&page=${page}`;
      // Only update src if it's actually different to avoid unnecessary reloads
      if (iframeRef.current.src !== newSrc) {
        iframeRef.current.src = newSrc;
        console.log(`[PdfViewer] Updated iframe src to: ${newSrc}`);
      }
    }
  }, [url, page]); // Depend on url and page

  // Initial src is set here, subsequent changes handled by useEffect
  return (
    <iframe
      ref={iframeRef}
      src={`${url}#toolbar=0&navpanes=0&view=Fit&page=${page}`} 
      className={cn("w-full h-full bg-white block", className)}
      title="Sheet Music"
      onLoad={onLoad}
      // No key prop here, React will reuse the DOM node
    />
  );
};

export default PdfViewer;