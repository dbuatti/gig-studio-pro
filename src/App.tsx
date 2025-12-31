import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/AuthProvider"; // Fixed: Use alias
import Index from "@/pages/Index"; // Fixed: Use alias
import Login from "@/pages/Login"; // Fixed: Use alias
import Landing from "@/pages/Landing"; // Fixed: Use alias
import NotFound from "@/pages/NotFound"; // Fixed: Use alias
import Profile from "@/pages/Profile"; // Fixed: Use alias
import PublicRepertoire from "@/pages/PublicRepertoire"; // Fixed: Use alias
import SheetReaderMode from "@/pages/SheetReaderMode"; // Fixed: Use alias
import SongStudio from "@/pages/SongStudio"; // Fixed: Use alias
import GigEntry from "@/pages/GigEntry"; // Fixed: Use alias
import PublicGigView from "@/pages/PublicGigView"; // Fixed: Use alias
import FloatingCommandDock from "@/components/FloatingCommandDock";
import UserGuideModal from "@/components/UserGuideModal";
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useTheme } from '@/hooks/use-theme'; // NEW: Import useTheme

const queryClient = new QueryClient();

const RootRoute = () => {
  const { session, loading } = useAuth();
  if (loading) return null; // Authenticated users go to Dashboard (Index), guests see Landing
  return session ? <Index /> : <Landing />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
};

const App = () => {
  const { theme } = useTheme(); // NEW: Use the theme hook

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