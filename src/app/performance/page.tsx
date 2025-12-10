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
import { FaFire, FaCheckCircle, FaClock, FaTasks } from 'react-icons/fa';

type PomodoroSession = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  task_id: string | null;
};

type TaskRow = {
  id: string;
  title: string;
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

type TaskFocus = {
  id: string;
  title: string;
  minutes: number;
  completed: boolean;
};

type TimeUnit = 'minutes' | 'hours';
type RangeDays = 7 | 30;

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

  const [timeUnit, setTimeUnit] = useState<TimeUnit>('minutes');
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);

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

      // Sesiones de Pomodoro
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

      // Tareas
      const {
        data: tasksData,
        error: tasksError,
      } = await supabaseClient
        .from('tasks')
        .select('id, title, completed')
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

      // Racha diaria (días consecutivos con al menos una sesión, empezando hoy)
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

  // Datos diarios para gráfico (según rango elegido) en minutos
  const dailyData: DailyPoint[] = useMemo(() => {
    const today = new Date();
    const points: DailyPoint[] = [];

    for (let i = rangeDays - 1; i >= 0; i--) {
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
  }, [sessions, rangeDays]);

  // Datos del gráfico según unidad seleccionada
  const chartData = useMemo(
    () =>
      dailyData.map((p) => ({
        ...p,
        value:
          timeUnit === 'minutes'
            ? p.minutes
            : Number((p.minutes / 60).toFixed(2)),
      })),
    [dailyData, timeUnit],
  );

  // Actividad de hoy
  const todayMetrics = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);

    const todaySessions = sessions.filter(
      (s) => s.started_at.slice(0, 10) === todayKey,
    );

    const minutesToday = todaySessions.reduce(
      (acc, s) => acc + (s.duration_minutes || 0),
      0,
    );

    return {
      pomodorosToday: todaySessions.length,
      minutesToday,
    };
  }, [sessions]);

  // Progreso de tareas
  const taskProgress = useMemo(() => {
    const total = tasks.length;
    const completed = stats.tasksCompleted;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  }, [tasks, stats.tasksCompleted]);

  // Ranking de tareas más enfocadas
  const topFocusedTasks: TaskFocus[] = useMemo(() => {
    const minutesByTask = new Map<string, number>();

    sessions.forEach((s) => {
      if (s.task_id) {
        const prev = minutesByTask.get(s.task_id) ?? 0;
        minutesByTask.set(s.task_id, prev + (s.duration_minutes || 0));
      }
    });

    const byId = new Map(tasks.map((t) => [t.id, t]));

    const items: TaskFocus[] = Array.from(minutesByTask.entries()).map(
      ([taskId, minutes]) => {
        const task = byId.get(taskId);
        return {
          id: taskId,
          title: task?.title ?? 'Tarea sin título',
          minutes,
          completed: task?.completed ?? false,
        };
      },
    );

    return items
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
  }, [sessions, tasks]);

  // Día más productivo (en minutos totales, sobre todas las sesiones)
  const bestDay = useMemo(() => {
    if (sessions.length === 0) return null;

    const totals = new Map<string, number>();

    sessions.forEach((s) => {
      const key = s.started_at.slice(0, 10);
      const prev = totals.get(key) ?? 0;
      totals.set(key, prev + (s.duration_minutes || 0));
    });

    let bestDate: string | null = null;
    let bestMinutes = 0;

    totals.forEach((minutes, date) => {
      if (minutes > bestMinutes) {
        bestMinutes = minutes;
        bestDate = date;
      }
    });

    if (!bestDate) return null;

    const label = new Date(bestDate).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });

    return { date: bestDate, label, minutes: bestMinutes };
  }, [sessions]);

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  // Tooltip personalizado para el gráfico
  const renderTooltip = (props: any) => {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;

    const value = payload[0].value as number;
    const unitLabel = timeUnit === 'minutes' ? 'min' : 'h';

    return (
      <div className="rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-soft">
          {value} {unitLabel} de enfoque
        </p>
      </div>
    );
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Rendimiento</h1>
        <p className="text-sm text-muted max-w-xl">
          Panel de estadísticas de estudio y productividad a partir de sus
          tareas y sesiones de Pomodoro.
        </p>
      </header>

      {error && (
        <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>
      )}

      {loadingStats ? (
        <p>Cargando estadísticas...</p>
      ) : (
        <>
          {/* Resumen principal */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex gap-3">
              <div className="mt-1">
                <FaClock className="text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xs font-semibold mb-1 text-soft">
                  Tiempo total de enfoque
                </h2>
                <p className="text-3xl font-bold">
                  {stats.totalMinutesFocus}
                  <span className="text-xs ml-1 text-muted">min</span>
                </p>
                <p className="text-xs text-muted mt-2">
                  Suma de todos los minutos registrados con el Pomodoro.
                </p>
              </div>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex gap-3">
              <div className="mt-1">
                <FaFire className="text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xs font-semibold mb-1 text-soft">
                  Racha de estudio
                </h2>
                <p className="text-3xl font-bold">
                  {stats.weekStreak}
                  <span className="text-xs ml-1 text-muted">días</span>
                </p>
                <p className="text-xs text-muted mt-2">
                  Días consecutivos, empezando hoy, con al menos una sesión de
                  Pomodoro.
                </p>
              </div>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex gap-3">
              <div className="mt-1">
                <FaTasks className="text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xs font-semibold mb-1 text-soft">
                  Tareas completadas
                </h2>
                <p className="text-3xl font-bold">
                  {stats.tasksCompleted}
                </p>
                <p className="text-xs text-muted mt-2">
                  Número de tareas marcadas como completadas en el gestor.
                </p>
              </div>
            </article>

            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex gap-3">
              <div className="mt-1">
                <FaCheckCircle className="text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xs font-semibold mb-1 text-soft">
                  Minutos vinculados a tareas
                </h2>
                <p className="text-3xl font-bold">
                  {stats.minutesLinkedToTasks}
                  <span className="text-xs ml-1 text-muted">min</span>
                </p>
                <p className="text-xs text-muted mt-2">
                  Tiempo de enfoque asociado explícitamente a tareas concretas.
                </p>
              </div>
            </article>
          </section>

          {/* Hoy + progreso tareas */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Actividad de hoy */}
            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex flex-col gap-2">
              <h2 className="text-xs font-semibold text-soft">
                Actividad de hoy
              </h2>
              <p className="text-sm text-muted">
                Panorama rápido de cómo va el día de estudio.
              </p>
              <div className="flex items-end mt-3">
              <div>
                 <p className="text-[11px] text-muted mb-1">Minutos de enfoque</p>
                <p className="text-2xl font-bold">
                  {todayMetrics.minutesToday}
                  <span className="text-xs ml-1 text-muted">min</span>
                </p>
              </div>
              <div className="ml-18"> 
                <p className="text-[11px] text-muted mb-1">Pomodoros</p>
                <p className="text-2xl font-bold">{todayMetrics.pomodorosToday}</p>
              </div>
             </div>
            </article>
            {/* Progreso de tareas */}
            <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex flex-col gap-3">
              <h2 className="text-xs font-semibold text-soft">
                Progreso de tareas
              </h2>
              <p className="text-sm text-muted">
                {taskProgress.total > 0 ? (
                  <>
                    {taskProgress.completed} de {taskProgress.total} tareas
                    completadas.
                  </>
                ) : (
                  'Todavía no hay tareas registradas.'
                )}
              </p>
              <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-soft)]"
                  style={{ width: `${taskProgress.percent}%` }}
                />
              </div>
              <p className="text-[11px] text-muted">
                {taskProgress.percent}% del total de tareas marcadas como
                completadas.
              </p>
            </article>
          </section>

          {/* Gráfico: últimos X días con toggle Minutos/Horas y 7/30 días */}
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-soft">
                  Enfoque (últimos {rangeDays} días)
                </h2>
                <p className="text-xs text-muted">
                  Suma diaria de tiempo de estudio registrado con el Pomodoro.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="inline-flex rounded-full border border-[var(--card-border)] text-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setTimeUnit('minutes')}
                    className={`px-3 py-1 ${
                      timeUnit === 'minutes'
                        ? 'bg-[var(--accent-soft)] text-[var(--primary)]'
                        : 'text-muted'
                    }`}
                  >
                    Minutos
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeUnit('hours')}
                    className={`px-3 py-1 ${
                      timeUnit === 'hours'
                        ? 'bg-[var(--accent-soft)] text-[var(--primary)]'
                        : 'text-muted'
                    }`}
                  >
                    Horas
                  </button>
                </div>

                <div className="inline-flex rounded-full border border-[var(--card-border)] text-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setRangeDays(7)}
                    className={`px-3 py-1 ${
                      rangeDays === 7
                        ? 'bg-[var(--accent-soft)] text-[var(--primary)]'
                        : 'text-muted'
                    }`}
                  >
                    7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeDays(30)}
                    className={`px-3 py-1 ${
                      rangeDays === 30
                        ? 'bg-[var(--accent-soft)] text-[var(--primary)]'
                        : 'text-muted'
                    }`}
                  >
                    30 días
                  </button>
                </div>
              </div>
            </div>

            {dailyData.every((p) => p.minutes === 0) ? (
              <p className="text-sm text-muted">
                Aún no hay sesiones de Pomodoro registradas en los últimos
                días.
              </p>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis
                      fontSize={11}
                       tickFormatter={(value) => {
                          const num = Number(value);
                          if (isNaN(num)) return value; // Evita crasheos si Recharts envía texto raro
                          return timeUnit === 'minutes' ? num : num.toFixed(1);
                       }}
                    />
                    <Tooltip content={renderTooltip} />
                    <Bar dataKey="value" fill="var(--accent)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {bestDay && (
              <p className="mt-3 text-xs text-muted">
                Día más productivo:{" "}
                <span className="font-semibold text-soft">
                  {bestDay.label}
                </span>{" "}
                con{" "}
                <span className="font-semibold text-soft">
                  {bestDay.minutes} min
                </span>{" "}
                de enfoque.
              </p>
            )}
          </section>

          {/* Ranking de tareas con más minutos de enfoque */}
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] mb-6">
            <h2 className="text-sm font-semibold mb-3 text-soft">
              Tareas con más minutos de enfoque
            </h2>

            {topFocusedTasks.length === 0 ? (
              <p className="text-sm text-muted">
                Aún no hay sesiones de Pomodoro vinculadas a tareas. Desde el
                módulo de Pomodoro puede asociar cada sesión a una tarea para
                ver este ranking.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {topFocusedTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between border border-[var(--card-border)] rounded-md px-3 py-2 bg-[var(--card-bg)]"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-[11px] text-muted">
                        {t.completed ? 'Completada' : 'Pendiente'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-soft">
                      {t.minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
