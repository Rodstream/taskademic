// src/app/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
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
import { FaClipboardList, FaClock, FaChartBar } from 'react-icons/fa';

type Priority = 'low' | 'medium' | 'high';

type TaskSummary = {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  priority: Priority | null;
};

type PomodoroSession = {
  id: string;
  user_id: string;
  started_at: string;
  duration_minutes: number;
};

type DailyPoint = {
  date: string;
  label: string;
  minutes: number;
};

export default function HomePage() {
  const { user, loading } = useAuth();

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [focusLast7, setFocusLast7] = useState(0);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskSummary[]>([]);
  const [dailyFocus, setDailyFocus] = useState<DailyPoint[]>([]);

  useEffect(() => {
    if (!user) {
      setDashboardLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      setDashboardLoading(true);
      setError(null);

      try {
        // ---- TAREAS ----
        const { data: tasksData, error: tasksError } = await supabaseClient
          .from('tasks')
          .select('id, title, due_date, completed, priority')
          .eq('user_id', user.id);

        if (tasksError) {
          console.error(tasksError);
          throw new Error('No se pudieron cargar las tareas.');
        }

        const tasksList = (tasksData ?? []) as TaskSummary[];
        const todayStr = new Date().toISOString().slice(0, 10);

        const pending = tasksList.filter((t) => !t.completed);
        const overdue = pending.filter(
          (t) => t.due_date !== null && t.due_date < todayStr,
        );

        const upcomingSorted = [...pending].sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });

        setPendingCount(pending.length);
        setOverdueCount(overdue.length);
        setUpcomingTasks(upcomingSorted.slice(0, 5));

        // ---- POMODORO ÚLTIMOS 7 DÍAS ----
        const since = new Date();
        since.setDate(since.getDate() - 6);
        const sinceStr = since.toISOString();

        const {
          data: sessionsData,
          error: sessionsError,
        } = await supabaseClient
          .from('pomodoro_sessions')
          .select('id, user_id, started_at, duration_minutes')
          .eq('user_id', user.id)
          .gte('started_at', sinceStr);

        if (sessionsError) {
          console.error(sessionsError);
          throw new Error('No se pudieron cargar las sesiones de Pomodoro.');
        }

        const sessionsList = (sessionsData ?? []) as PomodoroSession[];

        const totalMinutesLast7 = sessionsList.reduce(
          (acc, s) => acc + (s.duration_minutes || 0),
          0,
        );
        setFocusLast7(totalMinutesLast7);

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

          const minutes = sessionsList
            .filter((s) => s.started_at.slice(0, 10) === key)
            .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

          points.push({ date: key, label, minutes });
        }

        setDailyFocus(points);
      } catch (err: any) {
        setError(err.message ?? 'Ocurrió un error en el panel principal.');
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboard();
  }, [user]);

  const hasData = useMemo(
    () =>
      pendingCount > 0 ||
      focusLast7 > 0 ||
      upcomingTasks.length > 0 ||
      dailyFocus.some((p) => p.minutes > 0),
    [pendingCount, focusLast7, upcomingTasks, dailyFocus],
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  // ================================
  // LANDING SIN SESIÓN
  // ================================
  if (!user) {
    return (
      <main className="min-h-screen px-4 py-12 max-w-5xl mx-auto flex flex-col gap-16">
        {/* HERO */}
        <section
          id="acerca-de"
          className="flex flex-col items-center text-center gap-5"
        >
          {/* Logo + chip */}
          <div className="flex flex-col items-center gap-2">
            <img
              src="/taskademic-logo.svg"
              alt="Logo de Taskademic"
              className="w-16 h-16 sm:w-20 sm:h-20"
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--card-border)] text-[11px] uppercase tracking-wide text-muted">
              <span>Plataforma para estudiantes</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold">
            Taskademic
          </h1>

          <p className="max-w-2xl text-sm sm:text-base text-soft leading-relaxed">
            Taskademic es una plataforma pensada para que estudiantes
            universitarios y terciarios organicen sus tareas, planifiquen
            el estudio y puedan ver, con claridad, cómo evoluciona su
            rendimiento académico a lo largo del cuatrimestre.
          </p>

          <p className="max-w-2xl text-sm sm:text-base text-muted leading-relaxed">
            Reúne en un solo lugar tareas, materias, sesiones de estudio
            con Pomodoro, calendario y estadísticas, para evitar el caos
            de tener la cursada repartida entre mil apps diferentes.
          </p>

          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-md bg-[var(--accent)] text-[var(--foreground)] text-sm font-semibold shadow-md shadow-black/20"
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-md border border-[var(--card-border)] text-sm hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
          </div>
        </section>

        {/* QUÉ PERMITE HACER – TARJETAS */}
        <section id="que-permite" className="flex flex-col gap-6">
          <header className="text-center">
            <h2 className="text-2xl font-semibold mb-1">
              ¿Qué permite hacer Taskademic?
            </h2>
            <p className="text-sm sm:text-base text-soft max-w-2xl mx-auto leading-relaxed">
              Unifica tareas, planificación y seguimiento del estudio en un
              solo lugar, con herramientas simples pero pensadas para la
              vida académica.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)] flex flex-col gap-2">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-soft)]">
                <FaClipboardList className="text-[var(--primary)]" />
              </div>
              <h3 className="font-semibold text-sm">
                Organizar tareas
              </h3>
              <p className="text-xs sm:text-sm text-soft leading-relaxed">
                Registre trabajos prácticos, parciales, finales y otras
                entregas. Asigne fecha límite, prioridad, etiquetas y
                materia para encontrar todo rápido.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)] flex flex-col gap-2">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-soft)]">
                <FaClock className="text-[var(--primary)]" />
              </div>
              <h3 className="font-semibold text-sm">
                Planificar el estudio
              </h3>
              <p className="text-xs sm:text-sm text-soft leading-relaxed">
                Use un temporizador Pomodoro integrado y un calendario que
                muestra las tareas en el tiempo, para decidir qué estudiar
                hoy, mañana o esta semana.
              </p>
            </article>

            <article className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)] flex flex-col gap-2">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-soft)]">
                <FaChartBar className="text-[var(--primary)]" />
              </div>
              <h3 className="font-semibold text-sm">
                Medir el rendimiento
              </h3>
              <p className="text-xs sm:text-sm text-soft leading-relaxed">
                Visualice minutos de enfoque, rachas de estudio y tareas
                completadas para ver, con datos, cómo avanza a lo largo del
                cuatrimestre.
              </p>
            </article>
          </div>
        </section>

        {/* CÓMO FUNCIONA – LAYOUT 2 COLUMNAS */}
        <section
          id="como-funciona"
          className="flex flex-col md:flex-row gap-8 md:items-start"
        >
          <div className="md:w-1/2 flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">
              ¿Cómo funciona en la práctica?
            </h2>
            <p className="text-sm sm:text-base text-soft leading-relaxed">
              El uso diario de Taskademic se basa en una rutina sencilla:
              registrar, planificar, estudiar y revisar. La idea es que el
              estudiante tenga una estructura clara sin perder flexibilidad.
            </p>
            <p className="text-sm sm:text-base text-soft leading-relaxed">
              Cada tarea, sesión de estudio y materia queda conectada, de
              modo que el tiempo dedicado a la cursada se vea reflejado en
              un panel de progreso.
            </p>
          </div>

          <div className="md:w-1/2">
            <ol className="list-decimal list-inside text-sm sm:text-base text-soft leading-relaxed space-y-2 border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)]">
              <li>
                Registrar materias y asignar un color a cada una para
                identificarlas fácilmente.
              </li>
              <li>
                Cargar tareas asociadas a esas materias indicando título,
                fecha límite, prioridad y tipo de trabajo.
              </li>
              <li>
                Iniciar sesiones de enfoque con el Pomodoro y vincularlas
                a tareas concretas, registrando el tiempo real de estudio.
              </li>
              <li>
                Consultar el panel de rendimiento para ver minutos de
                enfoque, rachas de estudio y tareas completadas.
              </li>
            </ol>
          </div>
        </section>

        {/* BENEFICIOS – BLOQUE FINAL */}
        <section id="beneficios" className="flex flex-col gap-4 mb-8">
          <h2 className="text-2xl font-semibold">
            Diseñada para la vida académica real
          </h2>
          <p className="text-sm sm:text-base text-soft leading-relaxed">
            Cursar varias materias a la vez implica entregas, parciales y
            proyectos que se superponen. Taskademic busca reducir esa
            sensación de caos ofreciendo:
          </p>

          <div className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)]">
            <ul className="list-disc list-inside text-sm sm:text-base text-soft leading-relaxed space-y-1">
              <li>
                Una vista unificada de todas las tareas y fechas clave.
              </li>
              <li>
                Una forma sencilla de priorizar qué hacer hoy, mañana o
                esta semana.
              </li>
              <li>
                Un registro objetivo del tiempo dedicado al estudio, materia
                por materia.
              </li>
              <li>
                Un panel de progreso que ayuda a ajustar el ritmo antes de
                que lleguen los exámenes.
              </li>
            </ul>
          </div>

          <p className="text-sm sm:text-base text-soft leading-relaxed">
            Todo con una interfaz cuidada, pensada para acompañar la cursada
            en el día a día sin agregar más ruido a la cabeza del estudiante.
          </p>
        </section>
      </main>
    );
  }

  // ================================
  // DASHBOARD CON SESIÓN
  // ================================
  return (
    <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="mb-2">
        <h1 className="text-2xl font-bold mb-1">Bienvenido a Taskademic</h1>
        <p className="text-sm text-muted">
          Un resumen rápido de su semana académica.
        </p>
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {/* Tarjetas de métricas rápidas */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
          <h2 className="text-xs font-semibold mb-1 text-soft">
            Tareas pendientes
          </h2>
          <p className="text-3xl font-bold">{pendingCount}</p>
          <p className="text-[11px] text-muted mt-2">
            Total de tareas aún sin completar.
          </p>
        </article>

        <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
          <h2 className="text-xs font-semibold mb-1 text-soft">
            Tareas vencidas
          </h2>
          <p className="text-3xl font-bold">{overdueCount}</p>
          <p className="text-[11px] text-muted mt-2">
            Tareas cuya fecha límite ya pasó.
          </p>
        </article>

        <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
          <h2 className="text-xs font-semibold mb-1 text-soft">
            Minutos de enfoque (7 días)
          </h2>
          <p className="text-3xl font-bold">{focusLast7}</p>
          <p className="text-[11px] text-muted mt-2">
            Tiempo total de estudio registrado con Pomodoro.
          </p>
        </article>
      </section>

      {/* Mini-gráfico */}
      <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
        <h2 className="text-sm font-semibold mb-3 text-soft">
          Minutos de enfoque (últimos 7 días)
        </h2>

        {dashboardLoading ? (
          <p className="text-sm text-muted">
            Cargando datos de estudio...
          </p>
        ) : dailyFocus.every((p) => p.minutes === 0) ? (
          <p className="text-sm text-muted">
            Aún no hay sesiones de Pomodoro registradas en los últimos
            días.
          </p>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyFocus}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="minutes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Accesos rápidos */}
      <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
        <h2 className="text-sm font-semibold mb-3 text-soft">
          Accesos rápidos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Link
            href="/tasks"
            className="border border-[var(--card-border)] rounded-md px-3 py-2 hover:bg-white/10 flex flex-col"
          >
            <span className="font-semibold mb-1">Gestionar tareas</span>
            <span className="text-[11px] text-muted">
              Cree, edite y organice sus pendientes.
            </span>
          </Link>

          <Link
            href="/pomodoro"
            className="border border-[var(--card-border)] rounded-md px-3 py-2 hover:bg-white/10 flex flex-col"
          >
            <span className="font-semibold mb-1">Iniciar Pomodoro</span>
            <span className="text-[11px] text-muted">
              Registre sesiones de estudio con enfoque.
            </span>
          </Link>

          <Link
            href="/calendar"
            className="border border-[var(--card-border)] rounded-md px-3 py-2 hover:bg-white/10 flex flex-col"
          >
            <span className="font-semibold mb-1">Ver calendario</span>
            <span className="text-[11px] text-muted">
              Visualice sus tareas en el calendario.
            </span>
          </Link>

          <Link
            href="/performance"
            className="border border-[var(--card-border)] rounded-md px-3 py-2 hover:bg-white/10 flex flex-col"
          >
            <span className="font-semibold mb-1">Ver rendimiento</span>
            <span className="text-[11px] text-muted">
              Revise estadísticas y logros de estudio.
            </span>
          </Link>
        </div>
      </section>

      {/* Próximas tareas */}
      <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-soft">Próximas tareas</h2>
          <Link
            href="/tasks"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {dashboardLoading ? (
          <p className="text-sm text-muted">Cargando tareas...</p>
        ) : !hasData ? (
          <p className="text-sm text-muted">
            No hay datos suficientes todavía. Cree algunas tareas o
            registre sesiones de Pomodoro para ver más información aquí.
          </p>
        ) : upcomingTasks.length === 0 ? (
          <p className="text-sm text-muted">
            No hay tareas pendientes próximas. Revise el gestor de tareas
            para más detalles.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {upcomingTasks.map((t) => {
              const p = t.priority ?? 'medium';
              const priorityLabel =
                p === 'high' ? 'Alta' : p === 'low' ? 'Baja' : 'Media';

              const priorityClass =
                p === 'high'
                  ? 'bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/40'
                  : p === 'low'
                  ? 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/40'
                  : 'bg-[var(--warn)]/15 text-[var(--warn)] border border-[var(--warn)]/40';

              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between border border-[var(--card-border)] rounded-md px-3 py-2 bg-[var(--card-bg)]"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{t.title}</span>
                    {t.due_date && (
                      <span className="text-[11px] text-muted">
                        Fecha límite: {t.due_date}
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${priorityClass}`}
                  >
                    Prioridad: {priorityLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
