"use client";

import { AudioContextInitializer } from "@/components/AudioContextInitializer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { useTheme } from '@/hooks/use-theme';
import React, { useEffect } from "react";
import MainLayout from "@/components/MainLayout"; 
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker source globally
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const queryClient = new QueryClient();

/**
 * ThemeProvider handles the application of the dark/light class to the document root.
 * By keeping this in a separate component, we prevent the entire App tree (including Auth and Router)
 * from re-mounting when the theme is toggled.
 */
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  return <>{children}</>;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-center" />
            <AudioContextInitializer>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <MainLayout />
              </BrowserRouter>
            </AudioContextInitializer>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;