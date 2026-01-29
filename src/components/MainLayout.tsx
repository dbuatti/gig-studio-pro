"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import PublicRepertoire from "@/pages/PublicRepertoire";
import SheetReaderMode from "@/pages/SheetReaderMode";
import SongStudio from "@/pages/SongStudio";
import GigEntry from "@/pages/GigEntry";
import PublicGigView from "@/pages/PublicGigView";
import DebugPage from "@/pages/DebugPage"; // Import DebugPage
import AudioTransposerModal from "@/components/AudioTransposerModal"; // NEW IMPORT
import Login from "@/pages/Login"; // FIX 11: Import Login

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
  const navigate = useNavigate(); // Added navigate import here for RootRoute
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
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/landing" element={<Landing />} />
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
      {/* Global Modals that should render outside of main content flow */}
      <AudioTransposerModal isOpen={false} onClose={() => {}} /> 
      <div id="modal-root" /> {/* Placeholder for modals outside the main flow if needed, though most are integrated */}
    </>
  );
};

export default MainLayout;