'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/context/PlanContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { validateCourseName, validateColor } from '@/lib/validation';
import { getLimitMessage } from '@/lib/plans';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Course = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
};

export default function CoursesPage() {
  const { user, loading } = useAuth();
  const { isWithinLimit } = usePlan();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('#80499d');

  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const fetchCourses = async () => {
      setLoadingCourses(true);
      setError(null);

      const { data, error } = await supabaseClient
        .from('courses')
        .select('id, user_id, name, color, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        setError('No se pudieron cargar las materias.');
      } else {
        setCourses((data ?? []) as Course[]);
      }

      setLoadingCourses(false);
    };

    fetchCourses();
  }, [user]);

  const handleAddCourse = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validar nombre
    const nameValidation = validateCourseName(name);
    if (!nameValidation.valid) {
      setError(nameValidation.error ?? 'Nombre inválido');
      return;
    }

    // Validar color
    const colorValidation = validateColor(color);
    if (!colorValidation.valid) {
      setError(colorValidation.error ?? 'Color inválido');
      return;
    }

    // Verificar límite del plan
    if (!isWithinLimit('courses', courses.length)) {
      setError(getLimitMessage('courses'));
      return;
    }

    setError(null);

    const { data, error } = await supabaseClient
      .from('courses')
      .insert({
        user_id: user.id,
        name: name.trim(),
        color: color || null,
      })
      .select('id, user_id, name, color, created_at')
      .single();

    if (error) {
      setError('No se pudo crear la materia.');
      return;
    }

    setCourses((prev) => [...prev, data as Course]);
    setName('');
  };

  const askDeleteCourse = (course: Course) => {
    setCourseToDelete(course);
  };

  const cancelDeleteCourse = () => {
    setCourseToDelete(null);
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete || !user) return;

    setDeleting(true);
    const { error } = await supabaseClient
      .from('courses')
      .delete()
      .eq('id', courseToDelete.id)
      .eq('user_id', user.id);

    setDeleting(false);

    if (error) {
      setError('No se pudo eliminar la materia.');
      return;
    }

    setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id));
    setCourseToDelete(null);
  };

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
            Mis Materias
          </h1>
          <p className="text-[var(--text-muted)] max-w-md mx-auto">
            Organiza tus cursos y asignaturas para gestionar mejor tus tareas académicas
          </p>
        </header>

        {/* Formulario nueva materia */}
        <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Agregar materia</h2>
              <p className="text-xs text-[var(--text-muted)]">Crea una nueva materia para tus tareas</p>
            </div>
          </div>

          <form onSubmit={handleAddCourse} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] transition-all duration-200"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la materia..."
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--background)] cursor-pointer hover:border-[var(--primary-soft)] transition-colors">
                <span
                  className="w-6 h-6 rounded-lg border-2 border-white/20 shadow-inner"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  className="sr-only"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="text-sm text-[var(--text-soft)]">Color</span>
              </label>

              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                Agregar
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-3 text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}
        </section>

        {/* Lista de materias */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--foreground)]">
              Tus materias
            </h2>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--card-bg)] px-3 py-1 rounded-full border border-[var(--card-border)]">
              {courses.length} {courses.length === 1 ? 'materia' : 'materias'}
            </span>
          </div>

          {loadingCourses ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)]/50">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-[var(--text-muted)] mb-1">No tienes materias todavía</p>
              <p className="text-xs text-[var(--text-muted)]">Agrega tu primera materia usando el formulario de arriba</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="group relative flex items-center gap-4 p-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--primary-soft)]/30 transition-all duration-200"
                >
                  {/* Indicador de color */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: c.color || 'var(--primary-soft)' }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[var(--foreground)] truncate">
                      {c.name}
                    </h3>
                  </div>

                  {/* Botón eliminar */}
                  <button
                    onClick={() => askDeleteCourse(c)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all duration-200"
                    title="Eliminar materia"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <ConfirmDialog
        open={!!courseToDelete}
        title="Eliminar materia"
        description={
          <>
            ¿Seguro que desea eliminar la materia{' '}
            <span className="font-medium">
              “{courseToDelete?.name}”
            </span>
            ? Las tareas seguirán existiendo, pero quedarán sin materia asignada.
          </>
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={cancelDeleteCourse}
        onConfirm={confirmDeleteCourse}
      />
    </>
  );
}
