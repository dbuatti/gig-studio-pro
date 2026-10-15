"use client";

import React, { useEffect, Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Routes, Route, Navigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PlaybackProvider } from "@/components/PlaybackProvider";
import GlobalPlayer from "@/components/GlobalPlayer";

const Login = React.lazy(() => import("@/pages/Login"));
const Landing = React.lazy(() => import("@/pages/Landing"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));
const GigEntry = React.lazy(() => import("@/pages/GigEntry"));
const PublicGigView = React.lazy(() => import("@/pages/PublicGigView"));
const PublicRepertoire = React.lazy(() => import("@/pages/PublicRepertoire"));
const Index = React.lazy(() => import("@/pages/Index"));
const Profile = React.lazy(() => import("@/pages/Profile"));
const SheetReaderMode = React.lazy(() => import("@/pages/SheetReaderMode"));
const AuditReaderMode = React.lazy(() => import("@/pages/AuditReaderMode"));
const SongStudio = React.lazy(() => import("@/pages/SongStudio"));
const DebugPage = React.lazy(() => import("@/pages/DebugPage"));
const EmergencyCleanup = React.lazy(() => import("@/pages/EmergencyCleanup"));

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
  if (loading) return <LoadingSpinner />;
  return session ? <Index /> : <Landing />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
};

const MainLayout = () => {
  return (
    <PlaybackProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <KeepAliveWorker />
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/repertoire/:slug" element={<PublicRepertoire />} />
          <Route path="/gig" element={<GigEntry />} />
          <Route path="/gig/:code" element={<PublicGigView />} />
          <Route path="/setlist/:id" element={<PublicGigView />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          
          {/* Protected Routes */}
          <Route path="/emergency-cleanup" element={<ProtectedRoute><EmergencyCleanup /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/sheet-reader/:songId?" element={<ProtectedRoute><SheetReaderMode /></ProtectedRoute>} />
          <Route path="/audit-reader/:songId?" element={<ProtectedRoute><AuditReaderMode /></ProtectedRoute>} />
          <Route path="/gig/:gigId/song/:songId" element={<ProtectedRoute><SongStudio /></ProtectedRoute>} />
          <Route path="/debug" element={<ProtectedRoute><DebugPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <GlobalPlayer />
    </PlaybackProvider>
  );
};

export default MainLayout;