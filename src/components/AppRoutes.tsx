"use client";

import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { useTheme } from '@/hooks/use-theme';
import { pdfjs } from 'react-pdf'; 

// Pages
import Login from "@/pages/Login"; 
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import PublicRepertoire from "@/pages/PublicRepertoire";
import SheetReaderMode from "@/pages/SheetReaderMode";
import SongStudio from "@/pages/SongStudio";
import GigEntry from "@/pages/GigEntry";
import PublicGigView from "@/pages/PublicGigView";
import DebugPage from "@/pages/DebugPage"; 

// Components
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import KeepAliveWorker from "@/components/KeepAliveWorker"; // Assuming KeepAliveWorker is moved/created

// Configure PDF.js worker source globally
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
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

const AppRoutes = () => {
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

export default AppRoutes;