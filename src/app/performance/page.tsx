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

// Color "semáforo" para notas (varía solo por nota, no por tema)
function gradeColor(value: number) {
  if (value >= 7) return 'var(--success)';
  if (value >= 4) return 'var(--warn)';
  return 'var(--danger)';
}

// Color de barra según tema (violeta en claro, naranja en oscuro)
function chartFillColor(theme: string | undefined) {
  if (theme === 'dark') {
    return 'var(--accent)'; // naranja en modo oscuro
  }
  return 'var(--primary-soft)'; // violeta en modo claro
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

      // ====== Notas y materias ======
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
    // horas
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

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-bold mb-2">Rendimiento</h1>
        <p className="text-sm text-gray-400">
          Este panel muestra estadísticas de estudio (Pomodoro, tareas) y
          rendimiento académico según las notas registradas en Taskademic.
        </p>
      </section>

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
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] mb-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold">
                  Enfoque (últimos 7 días)
                </h2>
                <p className="text-xs text-gray-400">
                  Suma diaria de tiempo de estudio registrado con el Pomodoro.
                </p>
              </div>
              <div className="inline-flex text-xs border border-[var(--card-border)] rounded-full overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTimeUnit('minutes')}
                  className={`px-3 py-1 ${
                    timeUnit === 'minutes'
                      ? 'bg-[var(--accent)] text-[var(--foreground)]'
                      : 'bg-transparent'
                  }`}
                >
                  Minutos
                </button>
                <button
                  type="button"
                  onClick={() => setTimeUnit('hours')}
                  className={`px-3 py-1 ${
                    timeUnit === 'hours'
                      ? 'bg-[var(--accent)] text-[var(--foreground)]'
                      : 'bg-transparent'
                  }`}
                >
                  Horas
                </button>
              </div>
            </div>

            {chartData.every((p) => p.value === 0) ? (
              <p className="text-sm text-gray-400">
                Aún no hay sesiones de Pomodoro registradas en los últimos días.
              </p>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      tickFormatter={(value) => {
                        const num = Number(value);
                        if (isNaN(num)) return value;
                        return timeUnit === 'minutes'
                          ? num
                          : num.toFixed(1);
                      }}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const num = Number(value);
                        if (isNaN(num)) return value as string;
                        return timeUnit === 'minutes'
                          ? `${num.toFixed(0)} min`
                          : `${num.toFixed(2)} h`;
                      }}
                    />
                    <Bar dataKey="value" fill={chartFillColor(theme)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Notas por materia */}
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
            <h2 className="text-sm font-semibold mb-1">
              Notas por materia
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Promedios de exámenes registrados en la sección &quot;Notas de
              exámenes&quot;.
            </p>

            {courseAverages.length === 0 ? (
              <p className="text-sm text-gray-400">
                Todavía no hay notas registradas. Cargue notas en la sección
                &quot;Notas de exámenes&quot; para ver su rendimiento académico
                por materia.
              </p>
            ) : (
              <>
                {(bestCourse || weakestCourse) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {bestCourse && (
                      <article className="border border-[var(--card-border)] rounded-lg px-3 py-2 bg-[var(--card-bg)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                          Mejor materia
                        </h3>
                        <p className="text-sm font-semibold">
                          {bestCourse.courseName}
                        </p>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: gradeColor(bestCourse.average) }}
                        >
                          Promedio: {bestCourse.average.toFixed(2)}
                        </p>
                      </article>
                    )}

                    {weakestCourse && (
                      <article className="border border-[var(--card-border)] rounded-lg px-3 py-2 bg-[var(--card-bg)]">
                        <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-1">
                          Materia a reforzar
                        </h3>
                          <p className="text-sm font-semibold">
                          {weakestCourse.courseName}
                        </p>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: gradeColor(weakestCourse.average) }}
                        >
                          Promedio: {weakestCourse.average.toFixed(2)}
                        </p>
                      </article>
                    )}
                  </div>
                )}

                <div className="w-full h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={courseAverages}
                      margin={{ top: 10, right: 20, bottom: 60, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="courseName"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        dy={10}
                      />
                      <YAxis
                        domain={[0, 10]}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => {
                          const num = Number(value);
                          if (isNaN(num)) return value;
                          return num.toFixed(1);
                        }}
                      />
                      <Tooltip
                        formatter={(value, _name, props) => {
                          const num = Number(value);
                          const label = props?.payload?.courseName ?? 'Materia';
                          if (isNaN(num)) return value as string;
                          return [`${num.toFixed(2)}`, label];
                        }}
                      />
                      <Bar dataKey="average" radius={[4, 4, 0, 0]}>
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

                <ul className="text-sm text-gray-300 space-y-1">
                  {courseAverages.map((c) => (
                    <li
                      key={c.courseId}
                      className="flex items-center justify-between border border-[var(--card-border)] rounded-md px-3 py-2 bg-[var(--card-bg)]"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {c.courseName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {c.count} examen{c.count !== 1 && 'es'} registrados
                        </span>
                      </div>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: gradeColor(c.average) }}
                      >
                        {c.average.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Próximos pasos */}
          <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
            <h2 className="text-sm font-semibold mb-2">Próximos pasos</h2>
            <ul className="list-disc list-inside text-sm text-gray-300">
              <li>
                Mostrar ranking de tareas según los minutos de enfoque
                acumulados.
              </li>
              <li>
                Agregar gráficos de evolución por materia o curso (promedio por
                cuatrimestre).
              </li>
              <li>
                Incorporar logros según rachas, objetivos cumplidos y notas
                alcanzadas.
              </li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
