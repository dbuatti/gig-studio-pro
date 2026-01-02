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
      const srcWithPage = `${url}#toolbar=0&navpanes=0&view=Fit&page=${page}`;
      // Only update src if it's actually different to avoid unnecessary reloads
      if (iframeRef.current.src !== srcWithPage) {
        iframeRef.current.src = srcWithPage;
        console.log(`[PdfViewer] Iframe src updated to: ${srcWithPage}`);
      }
    }
  }, [url, page]); // Depend on url and page

  return (
    <iframe
      ref={iframeRef}
      // Removed the 'key' prop to prevent React from forcing a re-render of the iframe component.
      // The src attribute is now updated imperatively via the ref.
      className={cn("w-full h-full bg-white block", className)}
      title="Sheet Music"
      onLoad={onLoad}
    />
  );
};

export default PdfViewer;