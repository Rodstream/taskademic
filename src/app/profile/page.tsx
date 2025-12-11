// src/app/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// Tipos
type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  career: string | null;
  university: string | null;
  academic_year: string | null;
};

// Helpers para ocultar email e ID
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Eliminar cuenta
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteDialogPasswordOpen, setDeleteDialogPasswordOpen] = useState(false);
  const [deleteDialogConfirmOpen, setDeleteDialogConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Redirección si no hay usuario
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  // Cargar datos del perfil
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

  // Guardar datos del perfil
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
      console.error(error);
      setErrorProfile('No se pudo guardar el perfil.');
      return;
    }

    setInfoProfile('Perfil actualizado correctamente.');
    setEditingProfile(false);
  };

  // Cambiar contraseña
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

    // Verificar contraseña actual con re-login
    const { error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: user?.email!,
      password: currentPassword,
    });

    if (loginError) {
      setChangingPassword(false);
      setErrorSecurity('La contraseña actual es incorrecta.');
      return;
    }

    // Actualizar contraseña
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
    }
  };

  // Procesar contraseña para eliminar cuenta
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

  // Eliminar definitivamente
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
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Perfil</h1>

      {/* ============================
          DATOS DEL USUARIO
      ============================ */}
      <section className="border border-[var(--card-border)] rounded-lg bg-[var(--card-bg)] p-4">
        <h2 className="text-lg font-semibold mb-4">Datos del usuario</h2>

        {/* Avatar de vista previa */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-full border border-[var(--card-border)] overflow-hidden flex items-center justify-center bg-black/10">
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
              <span className="text-xl font-semibold">
                {fullName
                  ? fullName.charAt(0).toUpperCase()
                  : user?.email?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            )}
          </div>

        {/* Nombre + resumen académico */}
          <div className="flex flex-col">
            <p className="text-sm font-semibold">
              {fullName || user?.email || 'Usuario de Taskademic'}
            </p>

            <p className="text-xs text-gray-400">
              {career || academicYear ? (
                <>
                  {career && <>Estudiando: {career}</>}
                  {career && academicYear && ' · '}
                  {!career && academicYear && <>Año/Cuatrimestre: </>}
                  {academicYear}
                </>
              ) : (
                'Puede completar su carrera y año/cuatrimestre en el perfil.'
              )}
            </p>
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-400">Email</p>
            <p className="font-mono text-sm break-all">
              {showEmail ? user!.email : censorEmail(user!.email!)}
            </p>
          </div>
          <button
            onClick={() => setShowEmail((v) => !v)}
            className="px-2 py-1 border rounded-md text-sm shrink-0"
          >
            {showEmail ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {/* ID */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-400">ID de usuario</p>
            <p className="font-mono text-sm break-all">
              {showId ? user!.id : censorId(user!.id)}
            </p>
          </div>
          <button
            onClick={() => setShowId((v) => !v)}
            className="px-2 py-1 border rounded-md text-sm shrink-0"
          >
            {showId ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {/* PERFIL EDITABLE */}
        {!editingProfile ? (
          <>
            <div className="mt-4 space-y-2 text-sm break-words">
              <p>
                <span className="text-gray-400">Nombre: </span>
                <span className="break-all">{fullName || 'Sin nombre'}</span>
              </p>
              <p className="flex items-center text-sm">
              <span className="text-gray-400 mr-1">Avatar URL:</span>
              {avatarUrl ? (
                <span
                  className="
                    inline-block
                    max-w-[75%]
                    truncate
                    align-middle
                  "
                  title={avatarUrl}
                >
                  {avatarUrl}
                </span>
              ) : (
                <span>—</span>
              )}
              </p>
              <p>
                <span className="text-gray-400">Carrera: </span>
                <span className="break-all">{career || '—'}</span>
              </p>
              <p>
                <span className="text-gray-400">Universidad: </span>
                <span className="break-all">{university || '—'}</span>
              </p>
              <p>
                <span className="text-gray-400">Año/Cuatrimestre: </span>
                <span className="break-all">{academicYear || '—'}</span>
              </p>
            </div>

            <button
              onClick={() => {
                setEditingProfile(true);
                setInfoProfile(null);
                setErrorProfile(null);
              }}
              className="mt-4 px-3 py-2 border rounded-md text-sm"
            >
              Editar perfil
            </button>

            {infoProfile && (
              <p className="text-green-500 text-sm mt-2 break-words">
                {infoProfile}
              </p>
            )}
            {errorProfile && (
              <p className="text-red-500 text-sm mt-2 break-words">
                {errorProfile}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 mt-4">
              <label className="flex flex-col gap-1 text-sm">
                <span>Nombre completo</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Avatar (URL)</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Carrera / área de estudio</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={career}
                  onChange={(e) => setCareer(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Universidad</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Año / cuatrimestre actual</span>
                <input
                  className="border rounded-md px-3 py-2"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                />
              </label>
            </div>

            {errorProfile && (
              <p className="text-red-500 text-sm mt-2 break-words">
                {errorProfile}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 border rounded-md bg-[var(--accent-soft)] text-sm"
              >
                {savingProfile ? 'Guardando…' : 'Guardar'}
              </button>

              <button
                onClick={() => {
                  setEditingProfile(false);
                  setErrorProfile(null);
                  setInfoProfile(null);
                }}
                className="px-4 py-2 border rounded-md text-sm"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </section>

      {/* ============================
          SEGURIDAD (CONTRASEÑA)
      ============================ */}
      <section className="border border-[var(--card-border)] rounded-lg bg-[var(--card-bg)] p-4">
        <h2 className="text-lg font-semibold mb-4">Seguridad</h2>

        {/* Cambiar contraseña */}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Contraseña actual</span>
            <input
              type="password"
              className="border rounded-md px-3 py-2"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Nueva contraseña</span>
            <input
              type="password"
              className="border rounded-md px-3 py-2"
              value={newPassword1}
              onChange={(e) => setNewPassword1(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Repetir nueva contraseña</span>
            <input
              type="password"
              className="border rounded-md px-3 py-2"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
          </label>

          <button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="px-4 py-2 border rounded-md bg-[var(--accent)] text-sm"
          >
            {changingPassword ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </div>

        {errorSecurity && (
          <p className="text-red-500 text-sm mt-2 break-words">
            {errorSecurity}
          </p>
        )}
        {infoSecurity && (
          <p className="text-green-500 text-sm mt-2 break-words">
            {infoSecurity}
          </p>
        )}

        {/* ELIMINAR CUENTA */}
        <div className="mt-6 pt-4 border-t border-[var(--card-border)]">
          <button
            onClick={() => {
              setDeletePassword('');
              setDeleteDialogPasswordOpen(true);
              setErrorSecurity(null);
            }}
            className="px-4 py-2 border border-red-500 text-red-600 rounded-md hover:bg-red-500/10 text-sm"
          >
            Eliminar cuenta
          </button>
        </div>
      </section>

      {/* Modal CONTRASEÑA para eliminar */}
      <ConfirmDialog
        open={deleteDialogPasswordOpen}
        title="Confirmar identidad"
        description="Ingrese su contraseña para continuar con la eliminación de su cuenta."
        confirmLabel="Verificar"
        cancelLabel="Cancelar"
        loading={false}
        onConfirm={handleDeletePasswordCheck}
        onCancel={() => setDeleteDialogPasswordOpen(false)}
      >
        <input
          type="password"
          className="mt-3 border rounded-md px-3 py-2 w-full"
          placeholder="Contraseña"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
        />
      </ConfirmDialog>

      {/* Modal FINAL de confirmación */}
      <ConfirmDialog
        open={deleteDialogConfirmOpen}
        title="Eliminar cuenta"
        description="¿Está seguro de que desea eliminar definitivamente su cuenta? Esta acción no se puede deshacer."
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialogConfirmOpen(false)}
      />
    </main>
  );
}
