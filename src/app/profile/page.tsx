// src/app/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  career: string | null;
  university: string | null;
  academic_year: string | null;
};

function censorEmail(email: string) {
  const [u, d] = email.split('@');
  const masked =
    u.length <= 2 ? '*'.repeat(u.length) : `${u.slice(0, 2)}${'*'.repeat(u.length - 2)}`;
  return `${masked}@${d}`;
}

function censorId(id: string) {
  return id.slice(0, 4) + '****' + id.slice(-4);
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Datos del perfil
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [career, setCareer] = useState('');
  const [university, setUniversity] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Mensajes
  const [infoProfile, setInfoProfile] = useState<string | null>(null);
  const [infoSecurity, setInfoSecurity] = useState<string | null>(null);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [errorSecurity, setErrorSecurity] = useState<string | null>(null);

  // Mostrar / ocultar email / ID
  const [showEmail, setShowEmail] = useState(false);
  const [showId, setShowId] = useState(false);

  // Cambiar contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Eliminar cuenta
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDialogPasswordOpen, setDeleteDialogPasswordOpen] = useState(false);
  const [deleteDialogConfirmOpen, setDeleteDialogConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
      } else if (data) {
        const p = data as Profile;
        setFullName(p.full_name ?? '');
        setAvatarUrl(p.avatar_url ?? '');
        setCareer(p.career ?? '');
        setUniversity(p.university ?? '');
        setAcademicYear(p.academic_year ?? '');
      }

      setLoadingProfile(false);
    };

    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSavingProfile(true);
    setErrorProfile(null);
    setInfoProfile(null);

    const { error } = await supabaseClient.from('profiles').upsert({
      id: user.id,
      full_name: fullName || null,
      avatar_url: avatarUrl || null,
      career: career || null,
      university: university || null,
      academic_year: academicYear || null,
    });

    setSavingProfile(false);

    if (error) {
      setErrorProfile('No se pudo guardar el perfil.');
      return;
    }

    setInfoProfile('Perfil actualizado correctamente.');
    setEditingProfile(false);
  };

  const handleChangePassword = async () => {
    setErrorSecurity(null);
    setInfoSecurity(null);

    if (!currentPassword) {
      setErrorSecurity('Debe ingresar su contraseña actual.');
      return;
    }

    if (newPassword1.length < 6) {
      setErrorSecurity('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword1 !== newPassword2) {
      setErrorSecurity('Las nuevas contraseñas no coinciden.');
      return;
    }

    setChangingPassword(true);

    const { error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: user?.email!,
      password: currentPassword,
    });

    if (loginError) {
      setChangingPassword(false);
      setErrorSecurity('La contraseña actual es incorrecta.');
      return;
    }

    const { error: updateError } = await supabaseClient.auth.updateUser({
      password: newPassword1,
    });

    setChangingPassword(false);

    if (updateError) {
      setErrorSecurity('No se pudo actualizar la contraseña.');
    } else {
      setInfoSecurity('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword1('');
      setNewPassword2('');
      setShowPasswordForm(false);
    }
  };

  const handleDeletePasswordCheck = async () => {
    if (!deletePassword) {
      setErrorSecurity('Debe ingresar su contraseña.');
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: user!.email!,
      password: deletePassword,
    });

    if (error) {
      setErrorSecurity('Contraseña incorrecta.');
      return;
    }

    setDeleteDialogPasswordOpen(false);
    setDeleteDialogConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!user) return;

    setDeleteLoading(true);

    await supabaseClient.from('profiles').delete().eq('id', user.id);
    await supabaseClient.rpc('delete_user', { uid: user.id });

    setDeleteLoading(false);
    setDeleteDialogConfirmOpen(false);

    router.push('/');
    router.refresh();
  };

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
          Mi Perfil
        </h1>
        <p className="text-[var(--text-muted)] max-w-md mx-auto">
          Gestiona tu información personal y configuración de cuenta
        </p>
      </header>

      {loadingProfile ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Tarjeta de perfil */}
          <section className="border border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)] backdrop-blur-sm overflow-hidden">
            {/* Banner con avatar */}
            <div className="h-24 bg-gradient-to-r from-[var(--primary-soft)] to-[var(--accent)] relative">
              <div className="absolute -bottom-10 left-6">
                <div className="w-20 h-20 rounded-2xl border-4 border-[var(--card-bg)] overflow-hidden bg-[var(--background)] flex items-center justify-center shadow-lg">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-2xl font-bold text-[var(--primary-soft)]">
                      {fullName
                        ? fullName.charAt(0).toUpperCase()
                        : user?.email?.charAt(0).toUpperCase() ?? 'U'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info del usuario */}
            <div className="pt-14 px-6 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--foreground)]">
                    {fullName || 'Usuario de Taskademic'}
                  </h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {user?.email}
                  </p>
                </div>
                {!editingProfile && (
                  <button
                    onClick={() => {
                      setEditingProfile(true);
                      setInfoProfile(null);
                      setErrorProfile(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)] transition-all duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="text-sm">Editar</span>
                  </button>
                )}
              </div>

              {/* Badges académicos */}
              <div className="flex flex-wrap gap-2 mb-6">
                {career && (
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--primary-soft)]/15 text-[var(--primary-soft)]">
                    {career}
                  </span>
                )}
                {university && (
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)]">
                    {university}
                  </span>
                )}
                {academicYear && (
                  <span className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--success)]/15 text-[var(--success)]">
                    {academicYear}
                  </span>
                )}
                {!career && !university && !academicYear && !editingProfile && (
                  <span className="text-xs text-[var(--text-muted)]">
                    Completa tu perfil para mostrar tu información académica
                  </span>
                )}
              </div>

              {/* Vista de datos o formulario de edición */}
              {!editingProfile ? (
                <>
                  {infoProfile && (
                    <p className="text-sm text-[var(--success)] bg-[var(--success)]/10 px-4 py-2 rounded-lg mb-4">
                      {infoProfile}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Nombre completo
                      </label>
                      <input
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Tu nombre"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Universidad
                      </label>
                      <input
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="Tu universidad"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Carrera / Área de estudio
                      </label>
                      <input
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                        value={career}
                        onChange={(e) => setCareer(e.target.value)}
                        placeholder="Tu carrera"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Año / Cuatrimestre
                      </label>
                      <input
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        placeholder="Ej: 3er año, 2do cuatrimestre"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--text-muted)] mb-2">
                      URL de avatar
                    </label>
                    <input
                      className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://ejemplo.com/tu-foto.jpg"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Ingresa la URL de una imagen para tu foto de perfil
                    </p>
                  </div>

                  {errorProfile && (
                    <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg">
                      {errorProfile}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingProfile ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingProfile(false);
                        setErrorProfile(null);
                        setInfoProfile(null);
                      }}
                      className="px-6 py-3 rounded-xl border border-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)] transition-all duration-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Información de cuenta */}
          <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--primary-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">Información de cuenta</h2>
                <p className="text-xs text-[var(--text-muted)]">Datos de acceso y seguridad</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Correo electrónico</p>
                  <p className="font-mono text-sm text-[var(--foreground)]">
                    {showEmail ? user!.email : censorEmail(user!.email!)}
                  </p>
                </div>
                <button
                  onClick={() => setShowEmail((v) => !v)}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]/30 transition-all"
                >
                  {showEmail ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* ID */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-muted)] mb-1">ID de usuario</p>
                  <p className="font-mono text-sm text-[var(--foreground)]">
                    {showId ? user!.id : censorId(user!.id)}
                  </p>
                </div>
                <button
                  onClick={() => setShowId((v) => !v)}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]/30 transition-all"
                >
                  {showId ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Configuración de cuenta */}
          <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">Configuración</h2>
                <p className="text-xs text-[var(--text-muted)]">Contraseña y opciones de cuenta</p>
              </div>
            </div>

            {infoSecurity && (
              <p className="text-sm text-[var(--success)] bg-[var(--success)]/10 px-4 py-2 rounded-lg mb-4">
                {infoSecurity}
              </p>
            )}

            <div className="space-y-3">
              {/* Cambiar contraseña */}
              {!showPasswordForm ? (
                <button
                  onClick={() => {
                    setShowPasswordForm(true);
                    setErrorSecurity(null);
                    setInfoSecurity(null);
                  }}
                  className="flex items-center gap-3 w-full p-4 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--primary-soft)] transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--card-border)]/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-[var(--foreground)]">Cambiar contraseña</p>
                    <p className="text-xs text-[var(--text-muted)]">Actualiza tu contraseña de acceso</p>
                  </div>
                  <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-[var(--foreground)]">Cambiar contraseña</h3>
                    <button
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword('');
                        setNewPassword1('');
                        setNewPassword2('');
                        setErrorSecurity(null);
                      }}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-border)]/30 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Contraseña actual
                      </label>
                      <input
                        type="password"
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--card-bg)] text-[var(--foreground)] transition-all duration-200"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Ingresa tu contraseña actual"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Nueva contraseña
                      </label>
                      <input
                        type="password"
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--card-bg)] text-[var(--foreground)] transition-all duration-200"
                        value={newPassword1}
                        onChange={(e) => setNewPassword1(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">
                        Confirmar nueva contraseña
                      </label>
                      <input
                        type="password"
                        className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--card-bg)] text-[var(--foreground)] transition-all duration-200"
                        value={newPassword2}
                        onChange={(e) => setNewPassword2(e.target.value)}
                        placeholder="Repite la nueva contraseña"
                      />
                    </div>

                    {errorSecurity && (
                      <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg">
                        {errorSecurity}
                      </p>
                    )}

                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="w-full px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {changingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
                    </button>
                  </div>
                </div>
              )}

              {/* Eliminar cuenta */}
              <button
                onClick={() => {
                  setDeletePassword('');
                  setDeleteDialogPasswordOpen(true);
                  setErrorSecurity(null);
                }}
                className="flex items-center gap-3 w-full p-4 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--danger)]/50 transition-all duration-200 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--card-border)]/30 group-hover:bg-[var(--danger)]/10 flex items-center justify-center transition-all">
                  <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--danger)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-[var(--foreground)] group-hover:text-[var(--danger)] transition-colors">Eliminar cuenta</p>
                  <p className="text-xs text-[var(--text-muted)]">Elimina permanentemente tu cuenta y datos</p>
                </div>
                <svg className="w-4 h-4 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </button>
            </div>
          </section>
        </>
      )}

      {/* Modal contraseña para eliminar */}
      <ConfirmDialog
        open={deleteDialogPasswordOpen}
        title="Confirmar identidad"
        description="Ingresa tu contraseña para continuar con la eliminación de tu cuenta."
        confirmLabel="Verificar"
        cancelLabel="Cancelar"
        loading={false}
        onConfirm={handleDeletePasswordCheck}
        onCancel={() => setDeleteDialogPasswordOpen(false)}
      >
        <input
          type="password"
          className="mt-3 border border-[var(--card-border)] rounded-xl px-4 py-3 w-full bg-[var(--background)] text-[var(--foreground)]"
          placeholder="Tu contraseña"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
      </ConfirmDialog>

      {/* Modal confirmación final */}
      <ConfirmDialog
        open={deleteDialogConfirmOpen}
        title="Eliminar cuenta permanentemente"
        description={
          <>
            <span className="font-medium">¿Estás completamente seguro?</span>
            <br /><br />
            Esta acción eliminará tu cuenta y todos tus datos de forma permanente.
            <span className="text-[var(--danger)] font-medium"> No se puede deshacer.</span>
          </>
        }
        confirmLabel="Sí, eliminar mi cuenta"
        cancelLabel="Cancelar"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogConfirmOpen(false)}
      />
    </main>
  );
}
