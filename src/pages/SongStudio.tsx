"use client";

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import SongStudioView from '@/components/SongStudioView';

const SongStudio = () => {
  const { gigId, songId } = useParams();
  const navigate = useNavigate();
  
  const dragX = useMotionValue(0);
  const opacity = useTransform(dragX, [0, 100], [1, 0.5]);

  if (!gigId || !songId) {
    navigate('/dashboard');
    return null;
  }

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      style={{ opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.15 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) navigate('/dashboard');
      }}
      className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden fixed inset-0 z-[100]"
    >
      <SongStudioView 
        gigId={gigId} 
        songId={songId} 
        onClose={() => navigate('/dashboard')} 
      />
    </motion.div>
  );
};

export default SongStudio;