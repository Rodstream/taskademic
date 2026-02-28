'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseClient } from '@/lib/supabaseClient';
import { FaEye, FaEyeSlash, FaEnvelope, FaLock, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);

  const [loading, setLoading]           = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [info, setInfo]                 = useState<string | null>(null);

  const attemptsRef      = useRef(0);
  const lockoutUntilRef  = useRef<number>(0);
  const emailRedirectTo  =
    typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (Date.now() < lockoutUntilRef.current) {
      const secsLeft = Math.ceil((lockoutUntilRef.current - Date.now()) / 1000);
      setError(`Demasiados intentos. Esperá ${secsLeft} segundos.`);
      return;
    }

    setLoading(true);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError('El email no está confirmado. Podés reenviar el correo de confirmación.');
        return;
      }
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        lockoutUntilRef.current = Date.now() + LOCKOUT_MS;
        attemptsRef.current = 0;
        setError('Demasiados intentos fallidos. Esperá 1 minuto antes de reintentar.');
        return;
      }
      setError('Credenciales inválidas. Verificá tu email y contraseña.');
      return;
    }

    attemptsRef.current = 0;
    if (data.session) router.push('/');
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    if (!email) { setError('Ingresá tu email para reenviar la confirmación.'); return; }
    setResendLoading(true);
    const { error } = await supabaseClient.auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
    setResendLoading(false);
    if (error) { setError(error.message); return; }
    setInfo('Correo de confirmación reenviado. Revisá tu bandeja y spam.');
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-gradient-to-br from-[var(--accent)]/15 via-[var(--primary-soft)]/8 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo + marca */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-[var(--accent)]/25 rounded-full blur-xl scale-150" />
            <Image src="/taskademic-logo.svg" alt="Taskademic" width={56} height={56} priority className="relative drop-shadow-md" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--foreground)]">Taskademic</p>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">Iniciá sesión en tu cuenta</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl p-8 flex flex-col gap-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">Email</span>
              <div className="relative">
                <FaEnvelope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>
            </label>

            {/* Contraseña */}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">Contraseña</span>
              <div className="relative">
                <FaLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--text-muted)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)]/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                </button>
              </div>
            </label>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-xs text-[var(--danger)]">
                <FaExclamationCircle className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Info */}
            {info && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/20 text-xs text-[var(--success)]">
                <FaCheckCircle className="shrink-0 mt-0.5" />
                <span>{info}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          {/* Reenviar confirmación */}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || loading}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50 text-center"
          >
            {resendLoading ? 'Reenviando…' : 'Reenviar correo de confirmación'}
          </button>
        </div>

        {/* Link a registro */}
        <p className="text-sm text-center text-[var(--text-muted)]">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="text-[var(--accent)] font-medium hover:underline">
            Registrarse
          </Link>
        </p>
      </div>
    </main>
  );
}
