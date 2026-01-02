import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { useTheme } from '@/hooks/use-theme';
import React, { useEffect } from "react";
import MainLayout from "@/components/MainLayout"; // Import the new MainLayout

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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <MainLayout /> {/* Render MainLayout here */}
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;