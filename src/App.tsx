import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import PublicRepertoire from "./pages/PublicRepertoire";
import SheetReaderMode from "./pages/SheetReaderMode"; // Ensure this import is correct
import SongStudio from "./pages/SongStudio";
import GigEntry from "./pages/GigEntry";
import PublicGigView from "./pages/PublicGigView";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/repertoire/:slug" element={<PublicRepertoire />} />
            <Route path="/gig" element={<GigEntry />} />
            <Route path="/gig/:code" element={<PublicGigView />} />
            <Route path="/setlist/:id" element={<PublicGigView />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            {/* Updated Route for Sheet Reader */}
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

export default App;