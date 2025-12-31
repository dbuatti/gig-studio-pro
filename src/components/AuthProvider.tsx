"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Use a ref to track the current session ID to avoid redundant updates
  const lastSessionId = useRef<string | null>(null);

  useEffect(() => {
    console.log("[AuthProvider] Initializing session check...");
    
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        console.log("[AuthProvider] Initial session recovered:", initialSession.user.id);
        lastSessionId.current = initialSession.access_token;
        setSession(initialSession);
        setUser(initialSession.user);
      } else {
        console.log("[AuthProvider] No initial session found.");
      }
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log(`[AuthProvider] Auth State Change Event: ${event}`);
      
      // Only trigger a state update if the session has actually changed
      // (e.g. login, logout, or token refresh with a new identity)
      const newSessionId = newSession?.access_token ?? null;
      
      if (newSessionId !== lastSessionId.current) {
        console.log("[AuthProvider] Session identity changed, updating state.");
        lastSessionId.current = newSessionId;
        setSession(newSession);
        setUser(newSession?.user ?? null);
      } else {
        console.log("[AuthProvider] Session identity unchanged, skipping state update.");
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log("[AuthProvider] Initiating sign out...");
    lastSessionId.current = null;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};