'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

type User = { id: number; email: string; name?: string | null };
type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  ready: boolean; // indica que ya se leyó localStorage
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  ready: false,
});

const TOKEN_KEY = 'taskademic_token';
const USER_KEY  = 'taskademic_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Rehidratar desde localStorage al montar
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
      }
    } finally {
      setReady(true);
    }
  }, []);

  const login = (u: User, t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
