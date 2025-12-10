'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
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
    if (!name.trim()) {
      setError('El nombre de la materia es obligatorio.');
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
      .select('*')
      .single();

    if (error) {
      console.error(error);
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
      console.error(error);
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
      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold mb-1">Materias</h1>
          <p className="text-sm text-gray-400">
            Defina las materias o cursos para organizar sus tareas académicas.
          </p>
        </header>

        <section className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)]">
          <h2 className="text-sm font-semibold mb-3">
            Nueva materia
          </h2>

          <form
            onSubmit={handleAddCourse}
            className="flex flex-col gap-3 text-sm"
          >
            <label className="flex flex-col gap-1">
              <span>Nombre</span>
              <input
                type="text"
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ejemplo: Álgebra I, Programación, Redes"
              />
            </label>

            <label className="flex items-center gap-2">
              <span>Color (opcional)</span>
              <input
                type="color"
                className="w-10 h-8 border border-[var(--card-border)] rounded-md bg-transparent p-0"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>

            <button
              type="submit"
              className="self-start mt-1 px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--foreground)] font-semibold"
            >
              Agregar materia
            </button>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </form>
        </section>

        <section className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)] text-sm">
          <h2 className="font-semibold mb-3">
            Lista de materias
          </h2>

          {loadingCourses ? (
            <p>Cargando materias...</p>
          ) : courses.length === 0 ? (
            <p className="text-gray-400">
              Aún no hay materias definidas. Cree una nueva con el formulario de arriba.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {courses.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border border-[var(--card-border)] rounded-md px-3 py-2 bg-[var(--card-bg)]"
                >
                  <div className="flex items-center gap-3">
                    {c.color && (
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    )}
                    <span className="font-medium">{c.name}</span>
                  </div>

                  <button
                    onClick={() => askDeleteCourse(c)}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
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
