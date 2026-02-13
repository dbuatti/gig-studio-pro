"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SetlistSong } from './SetlistManager';

interface SongInfoOverlayProps {
  song: SetlistSong | null;
}

const SongInfoOverlay: React.FC<SongInfoOverlayProps> = ({ song }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showOverlay = useCallback(() => {
    setIsVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 3500);
  }, []);

  // Trigger on song change
  useEffect(() => {
    if (song) {
      showOverlay();
    }
  }, [song?.id, showOverlay]);

  // Trigger on mouse movement
  useEffect(() => {
    const handleMouseMove = () => {
      showOverlay();
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showOverlay]);

  if (!song) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -5, scale: 0.98, transition: { duration: 1, ease: "easeInOut" } }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
        >
          <div className="bg-slate-950/60 backdrop-blur-md border border-white/5 px-4 py-2 rounded-xl shadow-2xl flex flex-col items-center text-center min-w-[180px]">
            <h3 className="text-[10px] font-black uppercase tracking-tight text-white/90 truncate max-w-[250px]">
              {song.name}
            </h3>
            <p className="text-[8px] font-bold text-indigo-400/80 uppercase tracking-widest mt-0.5 truncate max-w-[250px]">
              {song.artist || "Unknown Artist"}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SongInfoOverlay;