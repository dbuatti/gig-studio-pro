"use client";

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle } from 'lucide-react';
import SongStudioView from '@/components/SongStudioView';

const SongStudio = () => {
  const { gigId, songId } = useParams<{ gigId: string; songId: string }>();
  const navigate = useNavigate();

  if (!gigId || !songId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-studio-background p-6">
        <EmptyState
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Song not found"
          description="This studio link is missing a gig or song id. Head back to your dashboard to open a song."
          primaryAction={
            <Button onClick={() => navigate('/')} className="h-11 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white hover:bg-indigo-500">
              Back to dashboard
            </Button>
          }
        />
      </div>
    );
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