// src/app/performance/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/context/PlanContext';
import { supabaseClient } from '@/lib/supabaseClient';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { FaSortAmountDown, FaSortAmountUp, FaChartLine, FaChartBar } from 'react-icons/fa';

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
  const { canAccess } = usePlan();
  const router = useRouter();
  const { theme } = useTheme();

  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPomodoros: 0,
    totalMinutesFocus: 0,
    minutesLinkedToTasks: 0,
    tasksCompleted: 0,
    weekStreak: 0,
  });

  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes');

  const [courseGrades, setCourseGrades] = useState<GradeWithCourse[]>([]);
  const [gradesSortOrder, setGradesSortOrder] = useState<'desc' | 'asc'>('desc');
  const [gradesView, setGradesView] = useState<'bar' | 'timeline' | 'distribution' | 'examType' | 'radar' | 'trend'>('bar');

  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar estadísticas desde Supabase (consultas en paralelo)
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoadingStats(true);
      setError(null);

      // Ejecutar todas las consultas en paralelo
      const [sessionsResult, tasksResult, coursesResult, gradesResult] = await Promise.all([
        supabaseClient
          .from('pomodoro_sessions')
          .select('id, user_id, started_at, ended_at, duration_minutes, task_id')
          .eq('user_id', user.id)
          .order('started_at', { ascending: true }),
        supabaseClient
          .from('tasks')
          .select('id, completed')
          .eq('user_id', user.id),
        supabaseClient
          .from('courses')
          .select('id, name')
          .eq('user_id', user.id),
        supabaseClient
          .from('course_grades')
          .select('id, course_id, grade, exam_type, exam_date')
          .eq('user_id', user.id),
      ]);

      // Procesar sesiones de Pomodoro
      if (sessionsResult.error) {
        setError('No se pudieron cargar las sesiones de Pomodoro.');
        setLoadingStats(false);
        return;
      }

      const sessionsList = (sessionsResult.data ?? []) as PomodoroSession[];
      setSessions(sessionsList);

      const totalPomodoros = sessionsList.length;
      const totalMinutesFocus = sessionsList.reduce(
        (acc, s) => acc + (s.duration_minutes || 0),
        0,
      );
      const minutesLinkedToTasks = sessionsList
        .filter((s) => s.task_id)
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

      // Procesar tareas
      if (tasksResult.error) {
        setError('No se pudieron cargar las tareas.');
        setLoadingStats(false);
        return;
      }

      const tasksList = (tasksResult.data ?? []) as TaskRow[];
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

      // Procesar materias y notas
      if (coursesResult.error) {
        console.warn('Error cargando materias en rendimiento:', coursesResult.error);
      }

      const coursesList = (coursesResult.data ?? []) as CourseRow[];
      const coursesMap = new Map(coursesList.map((c) => [c.id, c.name]));

      if (gradesResult.error) {
        console.warn(
          'Error cargando notas de exámenes en rendimiento:',
          gradesResult.error,
        );
      } else {
        const rawGrades = (gradesResult.data ?? []) as CourseGradeRow[];
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

    // Ordenar según el estado
    if (gradesSortOrder === 'desc') {
      result.sort((a, b) => b.average - a.average);
    } else {
      result.sort((a, b) => a.average - b.average);
    }
    return result;
  }, [courseGrades, gradesSortOrder]);

  // Datos para línea temporal (evolución de notas por mes)
  const timelineData = useMemo(() => {
    if (!courseGrades.length) return [];

    // Agrupar notas por mes
    const monthlyData = new Map<string, { total: number; count: number; grades: number[] }>();

    for (const g of courseGrades) {
      if (!g.exam_date) continue;

      const date = new Date(g.exam_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const entry = monthlyData.get(monthKey) ?? { total: 0, count: 0, grades: [] };
      entry.total += g.grade;
      entry.count += 1;
      entry.grades.push(g.grade);
      monthlyData.set(monthKey, entry);
    }

    // Convertir a array y ordenar por fecha
    const result = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
        promedio: Number((data.total / data.count).toFixed(2)),
        cantidad: data.count,
        mejor: Math.max(...data.grades),
        peor: Math.min(...data.grades),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

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

  // Distribución de notas por categoría
  const distributionData = useMemo(() => {
    if (!courseGrades.length) return [];

    const categories = {
      excelente: { name: 'Excelente (9-10)', value: 0, color: 'var(--success)' },
      muyBien: { name: 'Muy bien (7-8)', value: 0, color: '#22c55e' },
      aprobado: { name: 'Aprobado (6)', value: 0, color: 'var(--warn)' },
      regular: { name: 'Regular (4-5)', value: 0, color: '#f97316' },
      desaprobado: { name: 'Desaprobado (<4)', value: 0, color: 'var(--danger)' },
    };

    for (const g of courseGrades) {
      if (g.grade >= 9) categories.excelente.value++;
      else if (g.grade >= 7) categories.muyBien.value++;
      else if (g.grade >= 6) categories.aprobado.value++;
      else if (g.grade >= 4) categories.regular.value++;
      else categories.desaprobado.value++;
    }

    return Object.values(categories).filter(c => c.value > 0);
  }, [courseGrades]);

  // Rendimiento por tipo de examen
  const examTypeData = useMemo(() => {
    if (!courseGrades.length) return [];

    const typeMap = new Map<string, { total: number; count: number }>();

    for (const g of courseGrades) {
      const examType = g.exam_type || 'Sin especificar';
      const entry = typeMap.get(examType) ?? { total: 0, count: 0 };
      entry.total += g.grade;
      entry.count += 1;
      typeMap.set(examType, entry);
    }

    return Array.from(typeMap.entries())
      .map(([name, data]) => ({
        name,
        promedio: Number((data.total / data.count).toFixed(2)),
        cantidad: data.count,
      }))
      .sort((a, b) => b.promedio - a.promedio);
  }, [courseGrades]);

  // Datos para gráfico radar por materia
  const radarData = useMemo(() => {
    if (!courseAverages.length) return [];

    // Normalizar a escala 0-10 para el radar
    return courseAverages.map(c => ({
      subject: c.courseName.length > 12 ? c.courseName.slice(0, 12) + '...' : c.courseName,
      fullName: c.courseName,
      promedio: c.average,
      fullMark: 10,
    }));
  }, [courseAverages]);

  // Tendencia acumulada (promedio acumulado a lo largo del tiempo)
  const trendData = useMemo(() => {
    if (!courseGrades.length) return [];

    // Ordenar notas por fecha
    const sortedGrades = [...courseGrades]
      .filter(g => g.exam_date)
      .sort((a, b) => (a.exam_date || '').localeCompare(b.exam_date || ''));

    if (sortedGrades.length === 0) return [];

    let runningSum = 0;
    const result = sortedGrades.map((g, index) => {
      runningSum += g.grade;
      const avgAccum = runningSum / (index + 1);
      return {
        fecha: new Date(g.exam_date! + 'T00:00:00').toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'short',
        }),
        promedio: Number(avgAccum.toFixed(2)),
        nota: g.grade,
        materia: g.courseName,
      };
    });

    return result;
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

          {!canAccess('performance_charts') && (
            <section className="flex flex-col items-center justify-center gap-4 py-12 border border-dashed border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)]/50">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Gráficos de rendimiento</h2>
                <p className="text-[var(--text-muted)] mb-4">Accede a análisis detallados de tu progreso académico con gráficos interactivos.</p>
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Mejorar a Premium
                </a>
              </div>
            </section>
          )}

          {canAccess('performance_charts') && (
          <>
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
              <div className="w-full h-64 [&_*]:outline-none">
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
                {/* Resumen rápido */}
                <div className="grid grid-cols-3 gap-2 p-3 mb-6 rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
                  {generalAverage !== null && (
                    <div className="text-center">
                      <p
                        className="text-xl font-bold"
                        style={{ color: gradeColor(generalAverage) }}
                      >
                        {generalAverage.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Promedio</p>
                    </div>
                  )}

                  {bestCourse && (
                    <div className="text-center border-x border-[var(--card-border)]">
                      <p
                        className="text-xl font-bold"
                        style={{ color: gradeColor(bestCourse.average) }}
                      >
                        {bestCourse.average.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide truncate px-1">
                        Mejor
                      </p>
                    </div>
                  )}

                  {weakestCourse && (
                    <div className="text-center">
                      <p
                        className="text-xl font-bold"
                        style={{ color: gradeColor(weakestCourse.average) }}
                      >
                        {weakestCourse.average.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide truncate px-1">
                        A reforzar
                      </p>
                    </div>
                  )}
                </div>

                {/* Selector de vista */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setGradesView('bar')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                      gradesView === 'bar'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]'
                    }`}
                  >
                    <FaChartBar />
                    Por materia
                  </button>
                  <button
                    onClick={() => setGradesView('timeline')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                      gradesView === 'timeline'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]'
                    }`}
                  >
                    <FaChartLine />
                    Evolución
                  </button>
                  <button
                    onClick={() => setGradesView('distribution')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                      gradesView === 'distribution'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]'
                    }`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                    Distribución
                  </button>
                  <button
                    onClick={() => setGradesView('examType')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                      gradesView === 'examType'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]'
                    }`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
                    </svg>
                    Por examen
                  </button>
                  <button
                    onClick={() => setGradesView('radar')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                      gradesView === 'radar'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]'
                    }`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" fill="none" stroke="currentColor" strokeWidth="2"/>
                      <polygon points="12,6 18,9.5 18,14.5 12,18 6,14.5 6,9.5" fill="currentColor" opacity="0.3"/>
                    </svg>
                    Radar
                  </button>
                  <button
                    onClick={() => setGradesView('trend')}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all duration-200 ${
                      gradesView === 'trend'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]'
                    }`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 17l6-6 4 4 8-8"/>
                      <path d="M17 7h4v4"/>
                    </svg>
                    Tendencia
                  </button>
                </div>

                {/* Gráfico de barras por materia */}
                {gradesView === 'bar' && (
                  <div className="w-full h-64 mb-6 [&_*]:outline-none">
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
                )}

                {/* Gráfico de línea temporal */}
                {gradesView === 'timeline' && (
                  <div className="w-full h-64 mb-6 [&_*]:outline-none">
                    {timelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={timelineData}
                          margin={{ top: 10, right: 20, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 10]}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card-bg)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number, name: string) => {
                              const labels: Record<string, string> = {
                                promedio: 'Promedio',
                                mejor: 'Mejor nota',
                                peor: 'Peor nota',
                              };
                              return [value.toFixed(2), labels[name] || name];
                            }}
                            labelFormatter={(label) => `Período: ${label}`}
                          />
                          <Legend
                            formatter={(value) => {
                              const labels: Record<string, string> = {
                                promedio: 'Promedio',
                                mejor: 'Mejor',
                                peor: 'Peor',
                              };
                              return labels[value] || value;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="promedio"
                            stroke="var(--accent)"
                            strokeWidth={2}
                            dot={{ fill: 'var(--accent)', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="mejor"
                            stroke="var(--success)"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={{ fill: 'var(--success)', r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="peor"
                            stroke="var(--danger)"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={{ fill: 'var(--danger)', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                        No hay datos con fechas para mostrar la evolución
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico de distribución (dona) */}
                {gradesView === 'distribution' && (
                  <div className="w-full h-72 mb-6 [&_*]:outline-none">
                    {distributionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${(name || '').toString().split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`}
                            labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
                          >
                            {distributionData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card-bg)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number, _name: string, props) => {
                              const total = distributionData.reduce((acc, d) => acc + d.value, 0);
                              const percent = ((value / total) * 100).toFixed(1);
                              return [`${value} notas (${percent}%)`, props.payload.name];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                        No hay datos para mostrar la distribución
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico por tipo de examen */}
                {gradesView === 'examType' && (
                  <div className="w-full h-64 mb-6 [&_*]:outline-none">
                    {examTypeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={examTypeData}
                          margin={{ top: 10, right: 20, bottom: 60, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
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
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card-bg)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number, _name: string, props) => [
                              `${value.toFixed(2)} (${props.payload.cantidad} exámenes)`,
                              'Promedio'
                            ]}
                          />
                          <Bar dataKey="promedio" radius={[6, 6, 0, 0]}>
                            {examTypeData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={gradeColor(entry.promedio)}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                        No hay datos para mostrar por tipo de examen
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico radar */}
                {gradesView === 'radar' && (
                  <div className="w-full h-72 mb-6 [&_*]:outline-none">
                    {radarData.length >= 3 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="var(--card-border)" />
                          <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                          />
                          <PolarRadiusAxis
                            domain={[0, 10]}
                            tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card-bg)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number, _name: string, props) => [
                              value.toFixed(2),
                              props.payload.fullName
                            ]}
                          />
                          <Radar
                            name="Promedio"
                            dataKey="promedio"
                            stroke="var(--accent)"
                            fill="var(--accent)"
                            fillOpacity={0.3}
                            strokeWidth={2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                        Se necesitan al menos 3 materias para el gráfico radar
                      </div>
                    )}
                  </div>
                )}

                {/* Gráfico de tendencia acumulada */}
                {gradesView === 'trend' && (
                  <div className="w-full h-64 mb-6 [&_*]:outline-none">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={trendData}
                          margin={{ top: 10, right: 20, bottom: 20, left: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="fecha"
                            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 10]}
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card-bg)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number, name: string, props) => {
                              if (name === 'promedio') {
                                return [value.toFixed(2), 'Promedio acumulado'];
                              }
                              return [`${value} (${props.payload.materia})`, 'Nota'];
                            }}
                          />
                          <Legend
                            formatter={(value) => {
                              const labels: Record<string, string> = {
                                promedio: 'Promedio acumulado',
                                nota: 'Nota individual',
                              };
                              return labels[value] || value;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="promedio"
                            stroke="var(--accent)"
                            strokeWidth={2}
                            dot={{ fill: 'var(--accent)', r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="nota"
                            stroke="var(--primary-soft)"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={{ fill: 'var(--primary-soft)', r: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
                        No hay datos con fechas para mostrar la tendencia
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de materias */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    Promedios por materia
                  </p>
                  <button
                    onClick={() => setGradesSortOrder((prev) => prev === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)] transition-all duration-200"
                    aria-label={`Ordenar por ${gradesSortOrder === 'desc' ? 'menor nota' : 'mayor nota'}`}
                  >
                    {gradesSortOrder === 'desc' ? (
                      <>
                        <FaSortAmountDown className="text-[var(--accent)]" />
                        <span>Mayor a menor</span>
                      </>
                    ) : (
                      <>
                        <FaSortAmountUp className="text-[var(--accent)]" />
                        <span>Menor a mayor</span>
                      </>
                    )}
                  </button>
                </div>
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

          </>
          )}

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
