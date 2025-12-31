import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Index from "@/pages/Index"; // Corrected import to default
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import Profile from "@/pages/Profile";
import PublicRepertoire from "@/pages/PublicRepertoire";
import SheetReaderMode from "@/pages/SheetReaderMode";
import SongStudio from "@/pages/SongStudio";
import GigEntry from "@/pages/GigEntry";
import PublicGigView from "@/pages/PublicGigView";
import FloatingCommandDock from "@/components/FloatingCommandDock";
import UserGuideModal from "@/components/UserGuideModal";
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useTheme } from '@/hooks/use-theme';
import React from "react"; // Import React for useEffect

const queryClient = new QueryClient();

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

const App = () => {
  const { theme } = useTheme();

  // Apply the theme class to the document's root element
  React.useEffect(() => {
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
            <Routes>
              {/* Professional Root Routing */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/repertoire/:slug" element={<PublicRepertoire />} />
              <Route path="/gig" element={<GigEntry />} />
              <Route path="/gig/:code" element={<PublicGigView />} />
              {/* Specific Setlist Public View */}
              <Route path="/setlist/:id" element={<PublicGigView />} />
              {/* Legacy dashboard redirect for backward compatibility */}
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/sheet-reader/:songId?" element={
                <ProtectedRoute>
                  <SheetReaderMode />
                </ProtectedRoute>
              } />
              <Route path="/gig/:gigId/song/:songId" element={
                <ProtectedRoute>
                  <SongStudio />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;