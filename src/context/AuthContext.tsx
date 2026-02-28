'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseClient } from '@/lib/supabaseClient';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabaseClient.auth.getSession();
        if (error) {
          // Token inválido o expirado — limpiar sesión local
          await supabaseClient.auth.signOut();
          setSession(null);
        } else {
          setSession(session ?? null);
        }
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      } else {
        setSession(session ?? null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
