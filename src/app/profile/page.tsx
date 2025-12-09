'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Redirigir si no hay usuario
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar perfil desde Supabase
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setLoadingProfile(true);
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setError('Error al cargar el perfil');
      } else if (data) {
        const profile = data as Profile;
        setFullName(profile.full_name ?? '');
      }

      setLoadingProfile(false);
    };

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    const { error } = await supabaseClient.from('profiles').upsert({
      id: user.id,
      full_name: fullName || null,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      setError('No se pudo guardar el perfil');
    } else {
      setInfo('Perfil guardado correctamente.');
    }
  };

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Perfil</h1>

      {loadingProfile ? (
        <p>Cargando datos de perfil...</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="border rounded-lg p-4 flex flex-col gap-4"
        >
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-sm font-mono break-all">{user?.email}</p>
          </div>

          <label className="flex flex-col gap-1">
            <span>Nombre completo</span>
            <input
              type="text"
              className="border rounded-md px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}

          <button
            type="submit"
            className="self-start px-4 py-2 border rounded-md bg-black text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      )}
    </main>
  );
}
