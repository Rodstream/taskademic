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
  ComposedChart,
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
import { FaSortAmountDown, FaSortAmountUp, FaChartLine, FaChartBar, FaFilePdf } from 'react-icons/fa';

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
  course_id: string | null;
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
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPomodoros: 0,
    totalMinutesFocus: 0,
    minutesLinkedToTasks: 0,
    tasksCompleted: 0,
    weekStreak: 0,
  });

  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours'>('minutes');
  const [period, setPeriod] = useState<'7d' | '30d' | '3m'>('7d');

  const [courseGrades, setCourseGrades] = useState<GradeWithCourse[]>([]);
  const [gradesSortOrder, setGradesSortOrder] = useState<'desc' | 'asc'>('desc');
  const [gradesView, setGradesView] = useState<'bar' | 'timeline' | 'distribution' | 'examType' | 'radar' | 'trend' | 'focus'>('bar');

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
          .select('id, completed, course_id')
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

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;

  // Datos diarios para gráfico (según período seleccionado)
  const dailyData: DailyPoint[] = useMemo(() => {
    const today = new Date();
    const points: DailyPoint[] = [];

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      const label =
        periodDays <= 7
          ? d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
          : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

      const minutes = sessions
        .filter((s) => s.started_at.slice(0, 10) === key)
        .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

      points.push({ date: key, label, minutes });
    }

    return points;
  }, [sessions, periodDays]);

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

  // Correlación entre tiempo de enfoque y nota por materia
  const focusCorrelationData = useMemo(() => {
    if (!courseAverages.length) return [];

    // task_id → course_id
    const taskCourseMap = new Map<string, string>();
    for (const t of tasks) {
      if (t.course_id) taskCourseMap.set(t.id, t.course_id);
    }

    // Acumular minutos por course_id
    const minutesByCourse = new Map<string, number>();
    for (const s of sessions) {
      if (!s.task_id) continue;
      const courseId = taskCourseMap.get(s.task_id);
      if (!courseId) continue;
      minutesByCourse.set(courseId, (minutesByCourse.get(courseId) ?? 0) + (s.duration_minutes || 0));
    }

    const entries = courseAverages.map((c) => ({
      name: c.courseName.length > 14 ? c.courseName.slice(0, 14) + '…' : c.courseName,
      fullName: c.courseName,
      promedio: c.average,
      minutos: minutesByCourse.get(c.courseId) ?? 0,
      horas: Number(((minutesByCourse.get(c.courseId) ?? 0) / 60).toFixed(1)),
    }));

    // Normalize hours to 0-10 scale so dots share the same Y axis as bars
    const maxHoras = Math.max(...entries.map(e => e.horas), 0.01);
    return entries
      .map((e) => ({ ...e, horasNorm: Number(((e.horas / maxHoras) * 10).toFixed(2)) }))
      .sort((a, b) => b.promedio - a.promedio);
  }, [courseAverages, tasks, sessions]);

  const todayMinutes = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return sessions
      .filter((s) => s.started_at.slice(0, 10) === today)
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
  }, [sessions]);

  const periodTrend = useMemo(() => {
    const now = Date.now();
    const msPerDay = 86_400_000;
    const curr = sessions
      .filter((s) => now - new Date(s.started_at).getTime() <= periodDays * msPerDay)
      .reduce((a, s) => a + (s.duration_minutes || 0), 0);
    const prev = sessions
      .filter((s) => {
        const age = now - new Date(s.started_at).getTime();
        return age > periodDays * msPerDay && age <= periodDays * 2 * msPerDay;
      })
      .reduce((a, s) => a + (s.duration_minutes || 0), 0);
    return prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
  }, [sessions, periodDays]);

  function handleExportPDF() {
    const date = new Date().toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const gradeRows = courseAverages
      .map(
        (c) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px">${c.courseName}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center">${c.count}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:700;text-align:center;color:${c.average >= 7 ? '#059669' : c.average >= 4 ? '#d97706' : '#dc2626'}">${c.average.toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const examRows = [...courseGrades]
      .sort((a, b) => (b.exam_date ?? '').localeCompare(a.exam_date ?? ''))
      .map(
        (g) => `
        <tr>
          <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px">${g.exam_date ? new Date(g.exam_date + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px">${g.courseName}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px">${g.exam_type ?? '—'}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:700;color:${g.grade >= 7 ? '#059669' : g.grade >= 4 ? '#d97706' : '#dc2626'}">${g.grade}</td>
        </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Reporte Académico — Taskademic</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;background:#fff;padding:48px 56px}
    @media print{body{padding:24px 32px}}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:20px;border-bottom:3px solid #210440}
    .brand{font-size:11px;color:#80499d;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
    .title{font-size:28px;font-weight:800;color:#210440;line-height:1.1}
    .email{font-size:12px;color:#666;margin-top:4px}
    .date-box{text-align:right;font-size:11px;color:#888;line-height:1.6}
    .date-box strong{color:#210440;font-size:13px}
    .section{margin-bottom:32px}
    .sec-title{font-size:11px;font-weight:700;color:#80499d;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #e8e0f5}
    .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:4px}
    .stat{background:#f7f3ff;border-radius:12px;padding:16px 10px;text-align:center}
    .stat-v{font-size:26px;font-weight:800;color:#210440}
    .stat-l{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .summary{display:flex;gap:12px;margin-bottom:20px}
    .sum-item{flex:1;background:#f7f3ff;border-radius:10px;padding:14px;text-align:center}
    .sum-v{font-size:22px;font-weight:800}
    .sum-l{font-size:9px;color:#888;text-transform:uppercase;margin-top:2px}
    table{width:100%;border-collapse:collapse}
    th{background:#f7f3ff;padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#555;border-bottom:1px solid #ddd}
    th:not(:first-child){text-align:center}
    .footer{margin-top:48px;padding-top:14px;border-top:1px solid #eee;text-align:center;font-size:10px;color:#bbb}
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="brand">Taskademic</div>
      <div class="title">Reporte Académico</div>
      <div class="email">${user?.email ?? ''}</div>
    </div>
    <div class="date-box">
      Generado el<br/>
      <strong>${date}</strong>
    </div>
  </div>

  <div class="section">
    <div class="sec-title">Estadísticas de estudio</div>
    <div class="stats">
      <div class="stat"><div class="stat-v">${stats.totalPomodoros}</div><div class="stat-l">Pomodoros</div></div>
      <div class="stat"><div class="stat-v">${stats.totalMinutesFocus}</div><div class="stat-l">Min. enfoque</div></div>
      <div class="stat"><div class="stat-v">${stats.minutesLinkedToTasks}</div><div class="stat-l">Min. en tareas</div></div>
      <div class="stat"><div class="stat-v">${stats.tasksCompleted}</div><div class="stat-l">Tareas compl.</div></div>
      <div class="stat"><div class="stat-v">${stats.weekStreak}</div><div class="stat-l">Racha (días)</div></div>
    </div>
  </div>

  ${
    courseAverages.length > 0
      ? `
  <div class="section">
    <div class="sec-title">Rendimiento académico por materia</div>
    ${
      generalAverage !== null
        ? `<div class="summary">
        <div class="sum-item">
          <div class="sum-v" style="color:${generalAverage >= 7 ? '#059669' : generalAverage >= 4 ? '#d97706' : '#dc2626'}">${generalAverage.toFixed(2)}</div>
          <div class="sum-l">Promedio general</div>
        </div>
        ${bestCourse ? `<div class="sum-item"><div class="sum-v" style="color:#059669">${bestCourse.average.toFixed(2)}</div><div class="sum-l">Mejor · ${bestCourse.courseName}</div></div>` : ''}
        ${weakestCourse ? `<div class="sum-item"><div class="sum-v" style="color:#dc2626">${weakestCourse.average.toFixed(2)}</div><div class="sum-l">A reforzar · ${weakestCourse.courseName}</div></div>` : ''}
      </div>`
        : ''
    }
    <table>
      <thead><tr><th>Materia</th><th>Exámenes</th><th>Promedio</th></tr></thead>
      <tbody>${gradeRows}</tbody>
    </table>
  </div>`
      : ''
  }

  ${
    courseGrades.length > 0
      ? `
  <div class="section">
    <div class="sec-title">Historial de exámenes</div>
    <table>
      <thead><tr><th>Fecha</th><th>Materia</th><th>Tipo</th><th>Nota</th></tr></thead>
      <tbody>${examRows}</tbody>
    </table>
  </div>`
      : ''
  }

  <div class="footer">
    Reporte generado por Taskademic &nbsp;·&nbsp; ${date}
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=960,height=720');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 600);
    }
  }

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const tooltipStyle = {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '16px',
    fontSize: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-10">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--foreground)]">
            <FaChartBar className="text-[var(--accent)]" />
            Rendimiento
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Seguí tu progreso académico y tus sesiones de enfoque
          </p>
        </div>
        {canAccess('export') ? (
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/40 text-sm font-medium transition-all duration-200 shrink-0 shadow-sm"
          >
            <FaFilePdf className="text-[var(--danger)]" size={13} />
            Exportar PDF
          </button>
        ) : (
          <a
            href="/pricing"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 text-sm font-medium text-[var(--accent)] transition-all duration-200 shrink-0"
            title="Función premium"
          >
            <FaFilePdf size={13} />
            Exportar PDF
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--accent)] text-[var(--foreground)] font-bold">
              PRO
            </span>
          </a>
        )}
      </header>

      {error && (
        <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg text-center">
          {error}
        </p>
      )}

      {loadingStats ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Today strip ────────────────────────────────────── */}
          {todayMinutes > 0 && (
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/8">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 6.343l-.707-.707m12.728 12.728l-.707-.707M6.343 17.657l-.707.707" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {todayMinutes} min de enfoque hoy
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {(todayMinutes / 60).toFixed(1)} h · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
          )}

          {/* ── Stats ──────────────────────────────────────────── */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                value: stats.totalPomodoros,
                label: 'Pomodoros',
                gradient: 'from-orange-400 to-amber-500',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
                colSpan: false,
                trend: null as number | null,
              },
              {
                value: stats.totalMinutesFocus,
                label: 'Min. enfoque',
                gradient: 'from-blue-400 to-indigo-500',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                colSpan: false,
                trend: periodTrend,
              },
              {
                value: stats.minutesLinkedToTasks,
                label: 'Min. en tareas',
                gradient: 'from-violet-400 to-purple-500',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
                colSpan: false,
                trend: null as number | null,
              },
              {
                value: stats.tasksCompleted,
                label: 'Completadas',
                gradient: 'from-emerald-400 to-green-500',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
                colSpan: false,
                trend: null as number | null,
              },
              {
                value: stats.weekStreak,
                label: 'Racha (días)',
                gradient: 'from-red-400 to-rose-500',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />,
                colSpan: true,
                trend: null as number | null,
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 flex flex-col gap-4 ${s.colSpan ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white shadow-sm`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{s.icon}</svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-[var(--foreground)]">{s.value}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs text-[var(--text-muted)] font-medium">{s.label}</p>
                    {s.trend !== null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${s.trend >= 0 ? 'bg-[var(--success)]/15 text-[var(--success)]' : 'bg-[var(--danger)]/15 text-[var(--danger)]'}`}>
                        {s.trend >= 0 ? '↑' : '↓'}{Math.abs(s.trend)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* ── Premium gate ─────────────────────────────────────── */}
          {!canAccess('performance_charts') && (
            <section className="flex flex-col items-center justify-center gap-5 py-16 rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)]">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent)]/5 flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-center max-w-xs">
                <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Gráficos de rendimiento</h2>
                <p className="text-sm text-[var(--text-muted)] mb-5">Accedé a análisis detallados de tu progreso académico con gráficos interactivos.</p>
                <a href="/pricing" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
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
            {/* ── Focus chart ──────────────────────────────────── */}
            <section className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
              <div className="p-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">Enfoque</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5">
                    {chartData.reduce((s, p) => s + p.minutes, 0)} min en los últimos {periodDays} días
                    {periodTrend !== null && (
                      <span className={`ml-2 text-xs font-semibold ${periodTrend >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        {periodTrend >= 0 ? '↑' : '↓'} {Math.abs(periodTrend)}% vs período anterior
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Selector de período */}
                  <div className="flex p-1 rounded-2xl bg-[var(--card-border)]/30 gap-0.5">
                    {(['7d', '30d', '3m'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                          period === p
                            ? 'bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  {/* Selector min/horas */}
                  <div className="flex p-1 rounded-2xl bg-[var(--card-border)]/30 gap-0.5">
                    {(['minutes', 'hours'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setTimeUnit(u)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                          timeUnit === u
                            ? 'bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {u === 'minutes' ? 'Min' : 'Horas'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                {chartData.every((p) => p.value === 0) ? (
                  <div className="flex flex-col items-center justify-center py-14 rounded-2xl bg-[var(--background)]/60">
                    <p className="text-sm font-medium text-[var(--text-muted)]">Sin actividad reciente</p>
                    <p className="text-xs text-[var(--text-muted)] opacity-70 mt-1">Usá el Pomodoro para registrar tu tiempo</p>
                  </div>
                ) : (
                  <div className="w-full h-72 [&_*]:outline-none">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barCategoryGap={periodDays <= 7 ? '38%' : periodDays <= 30 ? '20%' : '10%'}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={periodDays <= 7 ? 0 : periodDays <= 30 ? 4 : 13} />
                        <YAxis fontSize={11} tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                          tickFormatter={(v) => { const n = Number(v); return isNaN(n) ? v : timeUnit === 'minutes' ? String(n) : n.toFixed(1); }}
                        />
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(value) => { const n = Number(value); return isNaN(n) ? value as string : timeUnit === 'minutes' ? `${n.toFixed(0)} min` : `${n.toFixed(2)} h`; }}
                          cursor={{ fill: 'var(--accent)', opacity: 0.06, radius: 8 }}
                        />
                        <Bar dataKey="value" fill={chartFillColor(theme)} radius={[8, 8, 3, 3]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </section>

            {/* ── Academic ─────────────────────────────────────── */}
            <section className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
              <div className="p-6 pb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Notas y promedios</h2>
              </div>

              {courseAverages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 mx-6 mb-6 rounded-2xl bg-[var(--background)]/60">
                  <p className="text-sm font-medium text-[var(--text-muted)]">Sin notas registradas</p>
                  <p className="text-xs text-[var(--text-muted)] opacity-70 mt-1">Registrá tus notas en la sección de Notas</p>
                </div>
              ) : (
                <>
                  {/* Summary strip */}
                  {generalAverage !== null && (
                    <div className="mx-6 mb-5 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-[var(--background)] border border-[var(--card-border)] p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: gradeColor(generalAverage) }}>{generalAverage.toFixed(2)}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">Promedio</p>
                      </div>
                      {bestCourse && (
                        <div className="rounded-2xl bg-[var(--background)] border border-[var(--card-border)] p-4 text-center">
                          <p className="text-2xl font-bold" style={{ color: gradeColor(bestCourse.average) }}>{bestCourse.average.toFixed(2)}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium truncate px-1" title={bestCourse.courseName}>Mejor</p>
                        </div>
                      )}
                      {weakestCourse && (
                        <div className="rounded-2xl bg-[var(--background)] border border-[var(--card-border)] p-4 text-center">
                          <p className="text-2xl font-bold" style={{ color: gradeColor(weakestCourse.average) }}>{weakestCourse.average.toFixed(2)}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium truncate px-1">A reforzar</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Apple-style segmented chart selector */}
                  <div className="px-6 mb-5">
                    <div className="flex p-1 rounded-2xl bg-[var(--card-border)]/30 gap-0.5 overflow-x-auto">
                      {([
                        { key: 'bar', label: 'Por materia' },
                        { key: 'timeline', label: 'Evolución' },
                        { key: 'distribution', label: 'Distribución' },
                        { key: 'examType', label: 'Por examen' },
                        { key: 'radar', label: 'Radar' },
                        { key: 'trend', label: 'Tendencia' },
                        { key: 'focus', label: 'Focus ↔ Nota' },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setGradesView(key)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                            gradesView === key
                              ? 'bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm'
                              : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="px-6">
                    {gradesView === 'bar' && (
                      <div className="w-full h-64 mb-5 [&_*]:outline-none">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={courseAverages} margin={{ top: 10, right: 20, bottom: 60, left: 20 }} barCategoryGap="38%">
                            <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                            <XAxis dataKey="courseName" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} interval={0} angle={-25} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => { const n = Number(v); return isNaN(n) ? v : n.toFixed(0); }} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value, _name, props) => { const n = Number(value); return isNaN(n) ? value as string : [`${n.toFixed(2)}`, props?.payload?.courseName ?? 'Materia']; }} cursor={{ fill: 'var(--accent)', opacity: 0.05, radius: 8 }} />
                            <Bar dataKey="average" radius={[8, 8, 3, 3]}>
                              {courseAverages.map((c) => <Cell key={c.courseId} fill={gradeColor(c.average)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {gradesView === 'timeline' && (
                      <div className="w-full h-64 mb-5 [&_*]:outline-none">
                        {timelineData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData} margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => { const labels: Record<string, string> = { promedio: 'Promedio', mejor: 'Mejor nota', peor: 'Peor nota' }; return [value.toFixed(2), labels[name] || name]; }} labelFormatter={(l) => `Período: ${l}`} />
                              <Legend formatter={(v) => ({ promedio: 'Promedio', mejor: 'Mejor', peor: 'Peor' } as Record<string, string>)[v] || v} />
                              <Line type="monotone" dataKey="promedio" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="mejor" stroke="var(--success)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ fill: 'var(--success)', r: 3, strokeWidth: 0 }} />
                              <Line type="monotone" dataKey="peor" stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="5 5" dot={{ fill: 'var(--danger)', r: 3, strokeWidth: 0 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">Sin datos con fechas</div>
                        )}
                      </div>
                    )}

                    {gradesView === 'distribution' && (
                      <div className="w-full h-72 mb-5 [&_*]:outline-none">
                        {distributionData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={distributionData} cx="50%" cy="50%" innerRadius={65} outerRadius={105} paddingAngle={3} dataKey="value"
                                label={({ name, percent }) => `${(name || '').toString().split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`}
                                labelLine={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
                              >
                                {distributionData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _n: string, props) => { const total = distributionData.reduce((a, d) => a + d.value, 0); return [`${value} notas (${((value / total) * 100).toFixed(1)}%)`, props.payload.name]; }} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">Sin datos</div>
                        )}
                      </div>
                    )}

                    {gradesView === 'examType' && (
                      <div className="w-full h-64 mb-5 [&_*]:outline-none">
                        {examTypeData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={examTypeData} margin={{ top: 10, right: 20, bottom: 60, left: 20 }} barCategoryGap="40%">
                              <CartesianGrid strokeDasharray="3 3" opacity={0.07} vertical={false} />
                              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-25} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _n: string, props) => [`${value.toFixed(2)} (${props.payload.cantidad} exámenes)`, 'Promedio']} cursor={{ fill: 'var(--accent)', opacity: 0.05, radius: 8 }} />
                              <Bar dataKey="promedio" radius={[8, 8, 3, 3]}>
                                {examTypeData.map((entry) => <Cell key={entry.name} fill={gradeColor(entry.promedio)} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">Sin datos por tipo de examen</div>
                        )}
                      </div>
                    )}

                    {gradesView === 'radar' && (
                      <div className="w-full h-72 mb-5 [&_*]:outline-none">
                        {radarData.length >= 3 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                              <PolarGrid stroke="var(--card-border)" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                              <PolarRadiusAxis domain={[0, 10]} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, _n: string, props) => [value.toFixed(2), props.payload.fullName]} />
                              <Radar name="Promedio" dataKey="promedio" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={2} />
                            </RadarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">Se necesitan al menos 3 materias</div>
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

                    {gradesView === 'focus' && (
                      <div className="w-full mb-5 [&_*]:outline-none">
                        {focusCorrelationData.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-14 rounded-2xl bg-[var(--background)]/60">
                            <p className="text-sm font-medium text-[var(--text-muted)]">Sin datos de enfoque vinculados</p>
                            <p className="text-xs text-[var(--text-muted)] opacity-70 mt-1">Vinculá sesiones Pomodoro a tareas con materia asignada</p>
                          </div>
                        ) : (() => {
                          const hasAnyFocus = focusCorrelationData.some(d => d.horas > 0);
                          return (
                          <>
                            {!hasAnyFocus && (
                              <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-[var(--warn)]/8 border border-[var(--warn)]/20 text-xs text-[var(--text-muted)]">
                                <span className="text-base leading-none shrink-0">💡</span>
                                <span>
                                  No hay sesiones Pomodoro vinculadas a tareas con materia. Para ver la correlación, en el Pomodoro seleccioná una tarea que tenga materia asignada.
                                </span>
                              </div>
                            )}
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={focusCorrelationData} margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={0} angle={-25} textAnchor="end" dy={10} axisLine={false} tickLine={false} />
                                  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                  <Tooltip
                                    contentStyle={tooltipStyle}
                                    formatter={(value: number, name: string, props) => {
                                      if (name === 'promedio') return [`${value.toFixed(2)} / 10`, 'Promedio nota'];
                                      if (name === 'horasNorm') return [`${props.payload.horas} h (${props.payload.minutos} min)`, 'Enfoque'];
                                      return [value, name];
                                    }}
                                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? _l}
                                  />
                                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '48px' }} formatter={(v) => ({ promedio: 'Promedio nota', horasNorm: 'Horas de enfoque' } as Record<string, string>)[v] ?? v} />
                                  <Line
                                    type="monotone"
                                    dataKey="promedio"
                                    stroke="var(--accent)"
                                    strokeWidth={2.5}
                                    dot={(props) => {
                                      const { cx = 0, cy = 0, payload } = props as { cx?: number; cy?: number; payload: { promedio: number; fullName: string } };
                                      return <circle key={payload.fullName} cx={cx} cy={cy} r={5} fill={gradeColor(payload.promedio)} stroke="var(--card-bg)" strokeWidth={2} />;
                                    }}
                                    activeDot={{ r: 7 }}
                                  />
                                  {hasAnyFocus && (
                                    <Line
                                      type="monotone"
                                      dataKey="horasNorm"
                                      stroke="var(--primary-soft)"
                                      strokeWidth={1.5}
                                      strokeDasharray="5 5"
                                      dot={(props) => {
                                        const { cx = 0, cy = 0, payload } = props as { cx?: number; cy?: number; payload: { horas: number; fullName: string } };
                                        if (payload.horas === 0) return <g key={payload.fullName} />;
                                        return (
                                          <g key={payload.fullName}>
                                            <circle cx={cx} cy={cy} r={4} fill="var(--primary-soft)" stroke="var(--card-bg)" strokeWidth={2} />
                                            <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill="var(--primary-soft)" fontWeight={600}>{payload.horas}h</text>
                                          </g>
                                        );
                                      }}
                                      activeDot={{ r: 6 }}
                                    />
                                  )}
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            {/* Insight automático */}
                            {(() => {
                              const withFocus = focusCorrelationData.filter(d => d.horas > 0);
                              if (withFocus.length < 2) return null;
                              const sorted = [...withFocus].sort((a, b) => b.horas - a.horas);
                              const mostStudied = sorted[0];
                              const leastStudied = sorted[sorted.length - 1];
                              const underperforming = withFocus.filter(d => d.horas >= mostStudied.horas * 0.6 && d.promedio < 6);
                              return (
                                <div className="mt-4 flex flex-col gap-2">
                                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] text-xs text-[var(--text-muted)]">
                                    <span className="text-base leading-none">📚</span>
                                    <span>Más tiempo de enfoque: <strong className="text-[var(--foreground)]">{mostStudied.fullName}</strong> — {mostStudied.horas} h · promedio {mostStudied.promedio.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--background)] border border-[var(--card-border)] text-xs text-[var(--text-muted)]">
                                    <span className="text-base leading-none">⏱️</span>
                                    <span>Menos tiempo de enfoque: <strong className="text-[var(--foreground)]">{leastStudied.fullName}</strong> — {leastStudied.horas} h · promedio {leastStudied.promedio.toFixed(2)}</span>
                                  </div>
                                  {underperforming.length > 0 && (
                                    <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--danger)]/8 border border-[var(--danger)]/20 text-xs text-[var(--text-muted)]">
                                      <span className="text-base leading-none">⚠️</span>
                                      <span>Mucho esfuerzo, resultado bajo en: <strong className="text-[var(--danger)]">{underperforming.map(d => d.fullName).join(', ')}</strong> — puede valer revisar el método de estudio</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                          );
                        })()}
                      </div>
                    )}

                  </div>{/* close charts div */}

                  {/* Grade ranking list with progress bars */}
                  <div className="px-6 pb-6 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-[var(--text-muted)]">
                        Ranking de materias
                      </p>
                      <button
                        onClick={() => setGradesSortOrder((prev) => prev === 'desc' ? 'asc' : 'desc')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]/60 transition-all duration-200"
                      >
                        {gradesSortOrder === 'desc'
                          ? <><FaSortAmountDown size={10} className="text-[var(--accent)]" /><span>Mayor a menor</span></>
                          : <><FaSortAmountUp size={10} className="text-[var(--accent)]" /><span>Menor a mayor</span></>
                        }
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {courseAverages.map((c, i) => (
                        <div
                          key={c.courseId}
                          className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--background)] border border-[var(--card-border)] hover:border-[var(--card-border)]/80 transition-colors"
                        >
                          <span className="text-xs font-bold text-[var(--text-muted)] w-5 shrink-0 text-center">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{c.courseName}</p>
                            <div className="mt-1.5 h-1.5 rounded-full bg-[var(--card-border)] overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all duration-700"
                                style={{ width: `${(c.average / 10) * 100}%`, backgroundColor: gradeColor(c.average) }}
                              />
                            </div>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">{c.count} {c.count === 1 ? 'examen' : 'exámenes'}</p>
                          </div>
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: gradeColor(c.average) }}
                          >
                            {c.average.toFixed(1)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
          )}

          {/* ── Legend ─────────────────────────────────────────── */}
          <section className="flex flex-wrap justify-center gap-6 text-xs pb-4">
            {[
              { color: 'var(--success)', label: 'Aprobado (7+)' },
              { color: 'var(--warn)', label: 'Regular (4–6)' },
              { color: 'var(--danger)', label: 'Desaprobado (<4)' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[var(--text-muted)] font-medium">{label}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
