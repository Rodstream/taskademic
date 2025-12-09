'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabaseClient';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
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
