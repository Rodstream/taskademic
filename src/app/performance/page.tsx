// src/app/performance/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type PomodoroSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  task_id: string | null;
};

type TaskRow = {
  id: string;
  completed: boolean;
};

type Stats = {
  totalPomodoros: number;
  totalMinutesFocus: number;
  minutesLinkedToTasks: number;
  tasksCompleted: number;
  weekStreak: number;
};

type DailyPoint = {
  date: string;
  label: string;
  minutes: number;
};

export default function PerformancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPomodoros: 0,
    totalMinutesFocus: 0,
    minutesLinkedToTasks: 0,
    tasksCompleted: 0,
    weekStreak: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar estadísticas desde Supabase
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      setError(null);

      const {
        data: sessionsData,
        error: sessionsError,
      } = await supabaseClient
        .from('pomodoro_sessions')
        .select('id, user_id, started_at, ended_at, duration_minutes, task_id')
        .eq('user_id', user.id)
        .order('started_at', { ascending: true });

      if (sessionsError) {
        console.error(sessionsError);
        setError('No se pudieron cargar las sesiones de Pomodoro.');
        setLoadingStats(false);
        return;
      }

      const sessionsList = (sessionsData ?? []) as PomodoroSession[];
      setSessions(sessionsList);

      const totalPomodoros = sessionsList.length;
      const totalMinutesFocus = sessionsList.reduce(
        (acc, s) => acc + (s.duration_minutes || 0),
        0,
      );
      const minutesLinkedToTasks = sessionsList
        .filter((s) => s.task_id)
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

      const {
        data: tasksData,
        error: tasksError,
      } = await supabaseClient
        .from('tasks')
        .select('id, completed')
        .eq('user_id', user.id);

      if (tasksError) {
        console.error(tasksError);
        setError('No se pudieron cargar las tareas.');
        setLoadingStats(false);
        return;
      }

      const tasksList = (tasksData ?? []) as TaskRow[];
      setTasks(tasksList);

      const tasksCompleted = tasksList.filter((t) => t.completed).length;

      // Racha diaria
      const datesWithSessions = new Set(
        sessionsList.map((s) =>
          new Date(s.started_at).toISOString().slice(0, 10),
        ),
      );

      let streak = 0;
      const cursor = new Date();

      while (true) {
        const key = cursor.toISOString().slice(0, 10);
        if (datesWithSessions.has(key)) {
          streak += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }

      setStats({
        totalPomodoros,
        totalMinutesFocus,
        minutesLinkedToTasks,
        tasksCompleted,
        weekStreak: streak,
      });
      setLoadingStats(false);
    };

    fetchStats();
  }, [user]);

  // Datos diarios para gráfico (últimos 7 días)
  const dailyData: DailyPoint[] = useMemo(() => {
    const today = new Date();
    const points: DailyPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      const label = d.toLocaleDateString('es-AR', {
        weekday: 'short',
        day: 'numeric',
      });

      const minutes = sessions
        .filter((s) => s.started_at.slice(0, 10) === key)
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

      points.push({ date: key, label, minutes });
    }

    return points;
  }, [sessions]);

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Rendimiento</h1>

      <p className="text-sm text-gray-400 mb-6">
        Este panel muestra estadísticas de estudio y productividad a partir de
        las tareas y sesiones de Pomodoro registradas.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {loadingStats ? (
        <p>Cargando estadísticas...</p>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-sm font-semibold mb-2">
                Pomodoros completados
              </h2>
              <p className="text-3xl font-bold">
                {stats.totalPomodoros}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Cantidad total de ciclos de enfoque registrados.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-sm font-semibold mb-2">
                Minutos de enfoque totales
              </h2>
              <p className="text-3xl font-bold">
                {stats.totalMinutesFocus}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Tiempo acumulado dedicado al estudio.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-sm font-semibold mb-2">
                Minutos vinculados a tareas
              </h2>
              <p className="text-3xl font-bold">
                {stats.minutesLinkedToTasks}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Tiempo de enfoque asociado explícitamente a una tarea de la
                lista.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
              <h2 className="text-sm font-semibold mb-2">
                Tareas completadas
              </h2>
              <p className="text-3xl font-bold">
                {stats.tasksCompleted}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Tareas marcadas como completadas en el gestor.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] sm:col-span-2">
              <h2 className="text-sm font-semibold mb-2">
                Racha de estudio
              </h2>
              <p className="text-3xl font-bold">
                {stats.weekStreak} días
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Días consecutivos (empezando hoy) con al menos una sesión de
                Pomodoro.
              </p>
            </article>
          </section>

          {/* Gráfico: últimos 7 días */}
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] mb-6">
            <h2 className="text-sm font-semibold mb-3">
              Minutos de enfoque (últimos 7 días)
            </h2>

            {dailyData.every((p) => p.minutes === 0) ? (
              <p className="text-sm text-gray-400">
                Aún no hay sesiones de Pomodoro registradas en los últimos días.
              </p>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="minutes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
            <h2 className="text-sm font-semibold mb-2">Próximos pasos</h2>
            <ul className="list-disc list-inside text-sm text-gray-300">
              <li>
                Mostrar ranking de tareas según los minutos de enfoque
                acumulados.
              </li>
              <li>
                Agregar gráficos de evolución por materia o curso (cuando se
                incorporen).
              </li>
              <li>
                Incorporar logros según rachas y objetivos cumplidos.
              </li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
