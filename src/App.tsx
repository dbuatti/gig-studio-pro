import { AudioContextInitializer } from "@/components/AudioContextInitializer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { useTheme } from '@/hooks/use-theme';
import React, { useEffect } from "react";
import MainLayout from "@/components/MainLayout"; 
import DebugPage from "@/pages/DebugPage"; // Import DebugPage
import { pdfjs } from 'react-pdf'; // Import pdfjs

// Configure PDF.js worker source globally
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const queryClient = new QueryClient();

const App = () => {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" />
          <AudioContextInitializer>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <MainLayout />
            </BrowserRouter>
          </AudioContextInitializer>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;