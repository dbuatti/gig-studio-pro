"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import PublicRepertoire from "@/pages/PublicRepertoire";
import SheetReaderMode from "@/pages/SheetReaderMode";
import SongStudio from "@/pages/SongStudio";
import GigEntry from "@/pages/GigEntry";
import PublicGigView from "@/pages/PublicGigView";
import DebugPage from "@/pages/DebugPage"; // Import DebugPage
import { pdfjs } from 'react-pdf'; // Import pdfjs

const RENDER_WORKER_URL = "https://yt-audio-api-1-wedr.onrender.com";

const KeepAliveWorker = () => {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    const pingWorker = async () => {
      try {
        await fetch(RENDER_WORKER_URL, { mode: 'no-cors' });
      } catch (e) {
        // Silent fail on heartbeat
      }
    };

    pingWorker();
    const interval = setInterval(pingWorker, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [session]);

  return null;
};

const RootRoute = () => {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <Index /> : <Landing />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
};

const MainLayout = () => {
  return (
    <>
      <KeepAliveWorker />
      {/* BrowserRouter is now removed from here as it's in App.tsx */}
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/repertoire/:slug" element={<PublicRepertoire />} />
        <Route path="/gig" element={<GigEntry />} />
        <Route path="/gig/:code" element={<PublicGigView />} />
        <Route path="/setlist/:id" element={<PublicGigView />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/sheet-reader/:songId?" element={<ProtectedRoute><SheetReaderMode /></ProtectedRoute>} />
        <Route path="/gig/:gigId/song/:songId" element={<ProtectedRoute><SongStudio /></ProtectedRoute>} />
        <Route path="/debug" element={<ProtectedRoute><DebugPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default MainLayout;