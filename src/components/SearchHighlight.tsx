"use client";

import React from 'react';

interface SearchHighlightProps {
  text: string;
  query: string;
  className?: string;
}

const SearchHighlight: React.FC<SearchHighlightProps> = ({ text, query, className }) => {
  if (!query.trim()) return <span className={className}>{text}</span>;

  const parts = text.split(new RegExp(`(${query.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));

  return (
    <span className={className}>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-indigo-500/30 text-indigo-200 rounded-sm px-0.5 no-underline">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export default SearchHighlight;