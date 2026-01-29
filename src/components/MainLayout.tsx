"use client";

import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { useTheme } from '@/hooks/use-theme';
import MainLayoutContent from "@/components/MainLayoutContent"; 
import DebugPage from "@/pages/DebugPage"; 
import { pdfjs } from 'react-pdf'; 
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import PublicRepertoire from "@/pages/PublicRepertoire";
import SheetReaderMode from "@/pages/SheetReaderMode";
import SongStudio from "@/pages/SongStudio";
import GigEntry from "@/pages/GigEntry";
import PublicGigView from "@/pages/PublicGigView";
import Login from "@/pages/Login"; 
import { useAuth } from "./AuthProvider";

// Configure PDF.js worker source globally
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const queryClient = new QueryClient();

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
  const navigate = useNavigate();
  
  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate('/dashboard');
    } else {
      navigate('/landing');
    }
  }, [session, loading, navigate]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
};

const MainLayoutContent = () => {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

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
    </>
  );
}

const MainLayout = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" />
          <BrowserRouter>
            <MainLayoutContent />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default MainLayout;