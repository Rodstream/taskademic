'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabaseClient';
import { validatePassword, getPasswordStrength } from '@/lib/validation';

const MAX_REGISTER_ATTEMPTS = 3;
const REGISTER_LOCKOUT_MS = 120_000; // 2 minutos

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Rate limiting
  const attemptsRef = useRef(0);
  const lockoutUntilRef = useRef<number>(0);

  // Calcular fortaleza de contraseña
  const passwordStrength = getPasswordStrength(password);
  const passwordValidation = validatePassword(password);

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

    // Validar contraseña antes de enviar
    if (!passwordValidation.valid) {
      setError('La contraseña debe tener: ' + passwordValidation.errors.join(', '));
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_REGISTER_ATTEMPTS) {
        lockoutUntilRef.current = Date.now() + REGISTER_LOCKOUT_MS;
        attemptsRef.current = 0;
        setError('Demasiados intentos. Espere 2 minutos antes de reintentar.');
        return;
      }
      setError(error.message);
      return;
    }

    // Dependiendo de la configuración de Supabase:
    // - puede requerir confirmación por email
    // - o crear la sesión directamente
    if (data.user && !data.session) {
      setInfo(
        'Registro correcto. Revise su correo para confirmar la cuenta antes de iniciar sesión.'
      );
      return;
    }

    if (data.session) {
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">Registrarse</h1>

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
              minLength={8}
            />
            {/* Indicador de fortaleza */}
            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        passwordStrength >= level
                          ? passwordStrength <= 1
                            ? 'bg-red-500'
                            : passwordStrength <= 2
                            ? 'bg-orange-500'
                            : passwordStrength <= 3
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {passwordStrength <= 1 && 'Muy débil'}
                  {passwordStrength === 2 && 'Débil'}
                  {passwordStrength === 3 && 'Buena'}
                  {passwordStrength >= 4 && 'Fuerte'}
                </p>
                {!passwordValidation.valid && (
                  <ul className="text-xs text-red-500 mt-1 list-disc list-inside">
                    {passwordValidation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span>Repetir contraseña</span>
            <input
              type="password"
              className="border rounded-md px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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
            type="submit"
            className="mt-2 px-4 py-2 rounded-md border bg-black text-white disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-4 text-sm text-center">
          ¿Ya tiene cuenta?{' '}
          <Link href="/login" className="text-blue-600 underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
