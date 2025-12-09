'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
};

type Session = {
  id: string;
  started_at: string;
  duration_minutes: number;
};

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      // usuario no logueado → se puede dejar el dashboard simple,
      // o redirigir a /login. Acá se lo deja ver pero sin datos.
      setLoadingData(false);
    }
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingData(true);

      const { data: tasksData } = await supabaseClient
        .from('tasks')
        .select('id, title, due_date, completed')
        .eq('user_id', user.id);

      const { data: sessionsData } = await supabaseClient
        .from('pomodoro_sessions')
        .select('id, started_at, duration_minutes')
        .eq('user_id', user.id);

      setTasks((tasksData ?? []) as Task[]);
      setSessions((sessionsData ?? []) as Session[]);
      setLoadingData(false);
    };

    fetchData();
  }, [user]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const {
    pendingCount,
    todayCount,
    todayMinutes,
    todayPomodoros,
    upcomingTasks,
  } = useMemo(() => {
    const pending = tasks.filter((t) => !t.completed);
    const todayTasks = pending.filter((t) => t.due_date === todayStr);

    const todaySessions = sessions.filter(
      (s) => s.started_at.slice(0, 10) === todayStr,
    );
    const minutes = todaySessions.reduce(
      (acc, s) => acc + (s.duration_minutes || 0),
      0,
    );

    const upcoming = pending
      .filter((t) => t.due_date && t.due_date >= todayStr)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 5);

    return {
      pendingCount: pending.length,
      todayCount: todayTasks.length,
      todayMinutes: minutes,
      todayPomodoros: todaySessions.length,
      upcomingTasks: upcoming,
    };
  }, [tasks, sessions, todayStr]);

  const handleGoToTasks = () => {
    router.push('/tasks');
  };

  const handleGoToPomodoro = () => {
    router.push('/pomodoro');
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {user ? 'Bienvenido a Taskademic' : 'Taskademic'}
          </h1>
          <p className="text-sm text-gray-400">
            Planifique, estudie y mida su rendimiento académico en un solo lugar.
          </p>
          {user && (
            <p className="text-xs text-gray-500 mt-1">
              Sesión iniciada como <span className="font-medium">{user.email}</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {!user && (
            <>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 rounded-md border border-[var(--card-border)] hover:bg-white/10"
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => router.push('/register')}
                className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--foreground)]"
              >
                Crear cuenta
              </button>
            </>
          )}

          {user && (
            <>
              <button
                onClick={handleGoToTasks}
                className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--foreground)]"
              >
                Ver tareas
              </button>
              <button
                onClick={handleGoToPomodoro}
                className="px-4 py-2 rounded-md border border-[var(--card-border)] hover:bg-white/10"
              >
                Iniciar Pomodoro
              </button>
            </>
          )}
        </div>
      </header>

      {user && (
        <>
          {/* Stats rápidas */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-xs font-semibold text-gray-400 mb-1">
                Tareas pendientes
              </h2>
              <p className="text-3xl font-bold">{pendingCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                Tareas abiertas en su lista.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-xs font-semibold text-gray-400 mb-1">
                Tareas para hoy
              </h2>
              <p className="text-3xl font-bold">{todayCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                Vencen el {todayStr}.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-xs font-semibold text-gray-400 mb-1">
                Minutos de enfoque hoy
              </h2>
              <p className="text-3xl font-bold">{todayMinutes}</p>
              <p className="text-xs text-gray-500 mt-1">
                Registrados con Pomodoro.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-xs font-semibold text-gray-400 mb-1">
                Pomodoros de hoy
              </h2>
              <p className="text-3xl font-bold">{todayPomodoros}</p>
              <p className="text-xs text-gray-500 mt-1">
                Ciclos de enfoque completados.
              </p>
            </article>
          </section>

          {/* Próximas tareas */}
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
            <h2 className="text-sm font-semibold mb-2">
              Próximas tareas
            </h2>

            {loadingData ? (
              <p>Cargando datos...</p>
            ) : upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-400">
                No hay tareas próximas. Cree una nueva desde la sección “Tareas”.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {upcomingTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex justify-between items-center border border-[var(--card-border)] rounded-md px-3 py-2 bg-[var(--card-bg)]"
                  >
                    <span>{t.title}</span>
                    <span className="text-xs text-gray-400">
                      vence: {t.due_date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {!user && (
        <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] text-sm">
          <h2 className="font-semibold mb-2">¿Qué es Taskademic?</h2>
          <p className="text-gray-400 mb-2">
            Taskademic es una herramienta diseñada para estudiantes
            universitarios y terciarios que combina:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Gestor de tareas académico.</li>
            <li>Modo Pomodoro integrado con sus trabajos.</li>
            <li>Panel de rendimiento y calendario de estudio.</li>
          </ul>
          <p className="mt-2 text-gray-400">
            Cree una cuenta para empezar a organizar su estudio de forma
            inteligente.
          </p>
        </section>
      )}
    </main>
  );
}
