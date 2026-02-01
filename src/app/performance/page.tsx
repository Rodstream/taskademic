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
  Cell,
} from 'recharts';
import { useTheme } from '@/context/ThemeContext';

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

type CourseRow = {
  id: string;
  name: string;
};

type CourseGradeRow = {
  id: string;
  course_id: string;
  grade: number;
  exam_type: string | null;
  exam_date: string | null;
};

type GradeWithCourse = CourseGradeRow & {
  courseName: string;
};

type CourseAverage = {
  courseId: string;
  courseName: string;
  average: number;
  count: number;
};

// Color "semáforo" para notas
function gradeColor(value: number) {
  if (value >= 7) return 'var(--success)';
  if (value >= 4) return 'var(--warn)';
  return 'var(--danger)';
}

// Color de barra según tema
function chartFillColor(theme: string | undefined) {
  if (theme === 'dark') {
    return 'var(--accent)';
  }
  return 'var(--primary-soft)';
}

export default function PerformancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPomodoros: 0,
    totalMinutesFocus: 0,
    minutesLinkedToTasks: 0,
    tasksCompleted: 0,
    weekStreak: 0,
  });

  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes');

  const [courseGrades, setCourseGrades] = useState<GradeWithCourse[]>([]);

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

      // Notas y materias
      const { data: coursesData, error: coursesError } = await supabaseClient
        .from('courses')
        .select('id, name')
        .eq('user_id', user.id);

      if (coursesError) {
        console.warn('Error cargando materias en rendimiento:', coursesError);
      }

      const coursesList = (coursesData ?? []) as CourseRow[];
      const coursesMap = new Map(coursesList.map((c) => [c.id, c.name]));

      const { data: gradesData, error: gradesError } = await supabaseClient
        .from('course_grades')
        .select('id, course_id, grade, exam_type, exam_date')
        .eq('user_id', user.id);

      if (gradesError) {
        console.warn(
          'Error cargando notas de exámenes en rendimiento:',
          gradesError,
        );
      } else {
        const rawGrades = (gradesData ?? []) as CourseGradeRow[];
        const withNames: GradeWithCourse[] = rawGrades.map((g) => ({
          ...g,
          courseName: coursesMap.get(g.course_id) ?? 'Materia desconocida',
        }));
        setCourseGrades(withNames);
      }

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

  // Transformar minutos a la unidad seleccionada
  const chartData = useMemo(() => {
    if (timeUnit === 'minutes') {
      return dailyData.map((p) => ({ ...p, value: p.minutes }));
    }
    return dailyData.map((p) => ({ ...p, value: p.minutes / 60 }));
  }, [dailyData, timeUnit]);

  // Promedios de notas por materia
  const courseAverages: CourseAverage[] = useMemo(() => {
    if (!courseGrades.length) return [];

    const map = new Map<string, { name: string; total: number; count: number }>();

    for (const g of courseGrades) {
      const entry = map.get(g.course_id) ?? {
        name: g.courseName,
        total: 0,
        count: 0,
      };
      entry.total += g.grade;
      entry.count += 1;
      map.set(g.course_id, entry);
    }

    const result: CourseAverage[] = [];
    for (const [courseId, entry] of map.entries()) {
      result.push({
        courseId,
        courseName: entry.name,
        average: entry.total / entry.count,
        count: entry.count,
      });
    }

    result.sort((a, b) => a.courseName.localeCompare(b.courseName));
    return result;
  }, [courseGrades]);

  // Mejor materia y materia a reforzar
  const bestCourse = useMemo(() => {
    if (!courseAverages.length) return null;
    return courseAverages.reduce((best, current) =>
      current.average > best.average ? current : best,
    );
  }, [courseAverages]);

  const weakestCourse = useMemo(() => {
    if (courseAverages.length < 2) return null;
    return courseAverages.reduce((worst, current) =>
      current.average < worst.average ? current : worst,
    );
  }, [courseAverages]);

  // Promedio general
  const generalAverage = useMemo(() => {
    if (!courseGrades.length) return null;
    const sum = courseGrades.reduce((acc, g) => acc + g.grade, 0);
    return sum / courseGrades.length;
  }, [courseGrades]);

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
          Rendimiento
        </h1>
        <p className="text-[var(--text-muted)] max-w-md mx-auto">
          Estadísticas de estudio y rendimiento académico
        </p>
      </header>

      {error && (
        <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg text-center">
          {error}
        </p>
      )}

      {loadingStats ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Tarjetas de estadísticas principales */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.totalPomodoros}</p>
              <p className="text-xs text-[var(--text-muted)]">Pomodoros</p>
            </div>

            <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--success)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.totalMinutesFocus}</p>
              <p className="text-xs text-[var(--text-muted)]">Min. enfoque</p>
            </div>

            <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--primary-soft)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--primary-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.minutesLinkedToTasks}</p>
              <p className="text-xs text-[var(--text-muted)]">Min. en tareas</p>
            </div>

            <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--success)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.tasksCompleted}</p>
              <p className="text-xs text-[var(--text-muted)]">Completadas</p>
            </div>

            <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center col-span-2 sm:col-span-1">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--warn)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--warn)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.weekStreak}</p>
              <p className="text-xs text-[var(--text-muted)]">Racha (días)</p>
            </div>
          </section>

          {/* Gráfico: últimos 7 días */}
          <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--foreground)]">Enfoque semanal</h2>
                  <p className="text-xs text-[var(--text-muted)]">Tiempo de estudio en los últimos 7 días</p>
                </div>
              </div>

              <div className="inline-flex border border-[var(--card-border)] rounded-xl overflow-hidden bg-[var(--background)]">
                <button
                  type="button"
                  onClick={() => setTimeUnit('minutes')}
                  className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    timeUnit === 'minutes'
                      ? 'bg-[var(--accent)] text-[var(--foreground)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Minutos
                </button>
                <button
                  type="button"
                  onClick={() => setTimeUnit('hours')}
                  className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    timeUnit === 'hours'
                      ? 'bg-[var(--accent)] text-[var(--foreground)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Horas
                </button>
              </div>
            </div>

            {chartData.every((p) => p.value === 0) ? (
              <div className="text-center py-12 border border-dashed border-[var(--card-border)] rounded-xl bg-[var(--background)]/50">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[var(--text-muted)] mb-1">Sin actividad reciente</p>
                <p className="text-xs text-[var(--text-muted)]">Usa el Pomodoro para registrar tu tiempo de estudio</p>
              </div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      tick={{ fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => {
                        const num = Number(value);
                        if (isNaN(num)) return value;
                        return timeUnit === 'minutes' ? String(num) : num.toFixed(1);
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => {
                        const num = Number(value);
                        if (isNaN(num)) return value as string;
                        return timeUnit === 'minutes'
                          ? `${num.toFixed(0)} min`
                          : `${num.toFixed(2)} h`;
                      }}
                    />
                    <Bar dataKey="value" fill={chartFillColor(theme)} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Rendimiento académico */}
          <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--primary-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">Rendimiento académico</h2>
                <p className="text-xs text-[var(--text-muted)]">Promedios de notas por materia</p>
              </div>
            </div>

            {courseAverages.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[var(--card-border)] rounded-xl bg-[var(--background)]/50">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--primary-soft)]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--primary-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-[var(--text-muted)] mb-1">Sin notas registradas</p>
                <p className="text-xs text-[var(--text-muted)]">Registra tus notas en la sección de Notas</p>
              </div>
            ) : (
              <>
                {/* Resumen de materias */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  {generalAverage !== null && (
                    <div className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--background)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">Promedio general</p>
                      <p
                        className="text-2xl font-bold"
                        style={{ color: gradeColor(generalAverage) }}
                      >
                        {generalAverage.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {bestCourse && (
                    <div className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--background)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">Mejor materia</p>
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {bestCourse.courseName}
                      </p>
                      <p
                        className="text-lg font-bold"
                        style={{ color: gradeColor(bestCourse.average) }}
                      >
                        {bestCourse.average.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {weakestCourse && (
                    <div className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--background)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">A reforzar</p>
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {weakestCourse.courseName}
                      </p>
                      <p
                        className="text-lg font-bold"
                        style={{ color: gradeColor(weakestCourse.average) }}
                      >
                        {weakestCourse.average.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Gráfico de notas */}
                <div className="w-full h-64 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={courseAverages}
                      margin={{ top: 10, right: 20, bottom: 60, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="courseName"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        dy={10}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => {
                          const num = Number(value);
                          if (isNaN(num)) return value;
                          return num.toFixed(0);
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(value, _name, props) => {
                          const num = Number(value);
                          const label = props?.payload?.courseName ?? 'Materia';
                          if (isNaN(num)) return value as string;
                          return [`${num.toFixed(2)}`, label];
                        }}
                      />
                      <Bar dataKey="average" radius={[6, 6, 0, 0]}>
                        {courseAverages.map((c) => (
                          <Cell
                            key={c.courseId}
                            fill={gradeColor(c.average)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Lista de materias */}
                <div className="flex flex-col gap-2">
                  {courseAverages.map((c) => (
                    <div
                      key={c.courseId}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--primary-soft)]/30 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: gradeColor(c.average) }}
                        >
                          {c.average.toFixed(1)}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">
                            {c.courseName}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {c.count} {c.count === 1 ? 'examen' : 'exámenes'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-lg font-bold"
                          style={{ color: gradeColor(c.average) }}
                        >
                          {c.average.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Leyenda de colores */}
          <section className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--success)]" />
              <span className="text-[var(--text-muted)]">Aprobado (7+)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--warn)]" />
              <span className="text-[var(--text-muted)]">Regular (4-6)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[var(--danger)]" />
              <span className="text-[var(--text-muted)]">Desaprobado (&lt;4)</span>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
