"use client";

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import SongStudioView from '@/components/SongStudioView';

const SongStudio = () => {
  const { gigId, songId } = useParams<{ gigId: string; songId: string }>();
  const navigate = useNavigate();

  if (!gigId || !songId) {
    // Handle case where parameters are missing (shouldn't happen if route is correct)
    return <div>Error: Missing gig or song ID.</div>;
  }

  const handleClose = () => {
    // Navigate back to the dashboard/index page
    navigate('/');
  };

  return (
    <div className="h-screen w-screen">
      <SongStudioView 
        gigId={gigId} 
        songId={songId} 
        onClose={handleClose} 
        // Since this is the full page view, we don't pass isModal or onExpand
      />
    </div>
  );
};

export default SongStudio;