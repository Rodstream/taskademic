'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;       // todavía leyendo localStorage
    if (!token) router.replace('/login');
  }, [ready, token, router]);

  if (!ready) return null;    // o un spinner
  if (!token) return null;    // mientras redirige

  return <>{children}</>;
}
