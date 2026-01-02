"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface PdfViewerProps {
  url: string;
  page: number;
  onLoad: () => void;
  className?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, page, onLoad, className }) => {
  const srcWithPage = `${url}#toolbar=0&navpanes=0&view=Fit&page=${page}`;

  return (
    <iframe
      key={srcWithPage} // This key will force re-render when url or page changes
      src={srcWithPage}
      className={cn("w-full h-full bg-white block", className)}
      title="Sheet Music"
      onLoad={onLoad}
    />
  );
};

export default PdfViewer;