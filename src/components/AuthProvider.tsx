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
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        lastSessionId.current = initialSession.access_token;
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Only trigger a state update if the session has actually changed
      const newSessionId = newSession?.access_token ?? null;
      
      if (newSessionId !== lastSessionId.current) {
        lastSessionId.current = newSessionId;
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
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