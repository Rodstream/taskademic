'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabaseClient';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minuto de bloqueo

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Rate limiting
  const attemptsRef = useRef(0);
  const lockoutUntilRef = useRef<number>(0);
  const emailRedirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Verificar lockout
    if (Date.now() < lockoutUntilRef.current) {
      const secsLeft = Math.ceil((lockoutUntilRef.current - Date.now()) / 1000);
      setError(`Demasiados intentos. Espere ${secsLeft} segundos.`);
      return;
    }

    setLoading(true);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('El email no esta confirmado. Puede reenviar el correo de confirmacion.');
        return;
      }

      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        lockoutUntilRef.current = Date.now() + LOCKOUT_MS;
        attemptsRef.current = 0;
        setError('Demasiados intentos fallidos. Espere 1 minuto antes de reintentar.');
        return;
      }
      setError('Credenciales inválidas. Verifique su email y contraseña.');
      return;
    }

    // Reset en login exitoso
    attemptsRef.current = 0;

    if (data.session) {
      router.push('/');
    }
  };

  const handleResendConfirmation = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError('Ingrese su email para reenviar la confirmacion.');
      return;
    }

    setResendLoading(true);

    const { error } = await supabaseClient.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo,
      },
    });

    setResendLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInfo('Correo de confirmacion reenviado. Revise su bandeja y spam.');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">Iniciar sesión</h1>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span>Email</span>
            <input
              type="email"
              className="border rounded-md px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span>Contraseña</span>
            <input
              type="password"
              className="border rounded-md px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && (
            <p className="text-red-600 text-sm">
              {error}
            </p>
          )}

          {info && (
            <p className="text-green-700 text-sm">
              {info}
            </p>
          )}

          <button
            type="button"
            className="text-sm underline text-blue-600 text-left disabled:opacity-60"
            disabled={resendLoading || loading}
            onClick={handleResendConfirmation}
          >
            {resendLoading ? 'Reenviando...' : 'Reenviar correo de confirmacion'}
          </button>

          <button
            type="submit"
            className="mt-2 px-4 py-2 rounded-md border bg-black text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          ¿No tiene cuenta?{' '}
          <Link href="/register" className="text-blue-600 underline">
            Registrarse
          </Link>
        </p>
      </div>
    </main>
  );
}
