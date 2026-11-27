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
  
  // Track by user id, not access token: token refreshes (TOKEN_REFRESHED) must
  // not be treated as a session change, otherwise downstream effects that depend
  // on `user` (e.g. reader data fetches) re-run and the page appears to refresh.
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        lastUserId.current = initialSession.user?.id ?? null;
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setLoading(false);
    }).catch(() => {
      // Never leave the app stuck on the loading screen if the session check
      // fails (offline, transient network error, invalid stored token).
      lastUserId.current = null;
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Token refreshes do not change the signed-in user and must not trigger
      // state updates / downstream refetches.
      if (event === 'TOKEN_REFRESHED') {
        // Supabase client keeps the refreshed token internally; React state
        // does not need to change, so no downstream effects re-run.
        setLoading(false);
        return;
      }

      const newUserId = newSession?.user?.id ?? null;
      if (newUserId !== lastUserId.current) {
        lastUserId.current = newUserId;
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
    lastUserId.current = null;
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