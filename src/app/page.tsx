// src/app/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { useTheme } from '@/context/ThemeContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  FaClock,
  FaChartBar,
  FaCalendarAlt,
  FaRocket,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFire,
  FaArrowRight,
  FaBook,
  FaGraduationCap,
  FaTasks,
  FaEnvelope,
} from 'react-icons/fa';

type Priority = 'low' | 'medium' | 'high';
type PriorityFilter = 'all' | Priority;

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

const PRIORITY_CONFIG = {
  high: {
    label: 'Alta',
    bg: 'bg-[var(--danger)]/10',
    text: 'text-[var(--danger)]',
    border: 'border-[var(--danger)]/30',
    icon: <FaExclamationTriangle className="text-[10px]" />,
  },
  medium: {
    label: 'Media',
    bg: 'bg-[var(--warn)]/10',
    text: 'text-[var(--warn)]',
    border: 'border-[var(--warn)]/30',
    icon: null,
  },
  low: {
    label: 'Baja',
    bg: 'bg-[var(--success)]/10',
    text: 'text-[var(--success)]',
    border: 'border-[var(--success)]/30',
    icon: null,
  },
} as const;

export default function HomePage() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [focusLast7, setFocusLast7] = useState(0);

  // guardo una lista base (ordenada por fecha) y luego filtro por prioridad en UI
  const [upcomingTasksBase, setUpcomingTasksBase] = useState<TaskSummary[]>([]);
  const [upcomingPriorityFilter, setUpcomingPriorityFilter] =
    useState<PriorityFilter>('all');

  const [dailyFocus, setDailyFocus] = useState<DailyPoint[]>([]);

  // Saludo según hora del día (debe estar antes de cualquier return condicional)
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  useEffect(() => {
    if (!user) {
      setDashboardLoading(false);
      return;
    }

    const fetchDashboard = async () => {
      setDashboardLoading(true);
      setError(null);

      try {
        const since = new Date();
        since.setDate(since.getDate() - 6);
        const sinceStr = since.toISOString();

        const tasksPromise = supabaseClient
          .from('tasks')
          .select('id, title, due_date, completed, priority')
          .eq('user_id', user.id);

        const sessionsPromise = supabaseClient
          .from('pomodoro_sessions')
          .select('id, user_id, started_at, duration_minutes')
          .eq('user_id', user.id)
          .gte('started_at', sinceStr);

        const [
          { data: tasksData, error: tasksError },
          { data: sessionsData, error: sessionsError },
        ] = await Promise.all([tasksPromise, sessionsPromise]);

        if (tasksError) {
          throw new Error('No se pudieron cargar las tareas.');
        }

        if (sessionsError) {
          throw new Error('No se pudieron cargar las sesiones de Pomodoro.');
        }

        const tasksList = (tasksData ?? []) as TaskSummary[];
        const todayStr = new Date().toISOString().slice(0, 10);

        const pending = tasksList.filter((t) => !t.completed);
        const overdue = pending.filter(
          (t) => t.due_date !== null && t.due_date < todayStr,
        );

        // Orden por fecha límite (sin fecha al final)
        const upcomingSorted = [...pending].sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        });

        setPendingCount(pending.length);
        setOverdueCount(overdue.length);
        setUpcomingTasksBase(upcomingSorted);

        const sessionsList = (sessionsData ?? []) as PomodoroSession[];

        const totalMinutesLast7 = sessionsList.reduce(
          (acc, s) => acc + (s.duration_minutes || 0),
          0,
        );
        setFocusLast7(totalMinutesLast7);

        const sessionsByDate = new Map<string, number>();
        for (const s of sessionsList) {
          const key = s.started_at.slice(0, 10);
          const minutes = s.duration_minutes || 0;
          sessionsByDate.set(key, (sessionsByDate.get(key) ?? 0) + minutes);
        }

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

          const minutes = sessionsByDate.get(key) ?? 0;

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
      upcomingTasksBase.length > 0 ||
      dailyFocus.some((p) => p.minutes > 0),
    [pendingCount, focusLast7, upcomingTasksBase, dailyFocus],
  );

  // filtro por prioridad en UI y muestro top 5
  const upcomingTasks = useMemo(() => {
    const filtered =
      upcomingPriorityFilter === 'all'
        ? upcomingTasksBase
        : upcomingTasksBase.filter(
            (t) => (t.priority ?? 'medium') === upcomingPriorityFilter,
          );

    return filtered.slice(0, 5);
  }, [upcomingTasksBase, upcomingPriorityFilter]);

  // color de barras como Rendimiento:
  // claro -> lila (primary-soft), oscuro -> naranja (accent)
  const barFill =
    theme === 'dark' ? 'var(--accent)' : 'var(--primary-soft)';
  const todayStr = new Date().toISOString().slice(0, 10);

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
      <main className="min-h-screen">
        {/* HERO */}
        <section className="relative overflow-hidden px-4 py-16 sm:py-24">
          {/* Fondo decorativo */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-[var(--accent)]/20 via-[var(--primary-soft)]/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-[var(--accent)]/15 to-transparent rounded-full blur-3xl" />
          </div>

          <div className="max-w-5xl mx-auto flex flex-col items-center text-center gap-6">
            {/* Logo y badge */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[var(--accent)]/30 rounded-full blur-xl scale-150" />
                <Image
                  src="/taskademic-logo.svg"
                  alt="Logo de Taskademic"
                  width={96}
                  height={96}
                  className="relative drop-shadow-lg"
                  priority
                />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] backdrop-blur-sm">
                <FaGraduationCap className="text-[var(--accent)] text-xs" />
                <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
                  Plataforma para estudiantes
                </span>
              </div>
            </div>

            {/* Título principal */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                Organiza tu{' '}
                <span className="text-[var(--accent)]">cursada</span>
                <br />
                en un solo lugar
              </h1>
              <p className="max-w-2xl mx-auto text-base sm:text-lg text-soft leading-relaxed">
                Taskademic te ayuda a gestionar tareas, planificar sesiones de estudio
                y visualizar tu progreso académico con claridad.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl hover:shadow-[var(--accent)]/30 transition-all duration-300 hover:-translate-y-0.5"
              >
                Comenzar gratis
                <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/50 backdrop-blur-sm font-medium hover:bg-[var(--card-bg)] transition-all duration-300"
              >
                Iniciar sesión
              </Link>
            </div>

            {/* Stats rápidos */}
            <div className="flex flex-wrap justify-center gap-8 mt-8 pt-8 border-t border-[var(--card-border)]">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold">Pomodoro</p>
                <p className="text-xs text-muted mt-1">Integrado</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold">Métricas</p>
                <p className="text-xs text-muted mt-1">En tiempo real</p>
              </div>
            </div>
          </div>
        </section>

        {/* CARACTERÍSTICAS */}
        <section className="px-4 py-16 bg-[var(--card-bg)]/30">
          <div className="max-w-5xl mx-auto">
            <header className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider mb-4">
                Características
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Todo lo que necesitas para tu cursada
              </h2>
              <p className="text-soft max-w-2xl mx-auto">
                Herramientas simples pero potentes, diseñadas para la vida académica.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tarjeta 1 */}
              <article className="group relative border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] hover:border-[var(--accent)]/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 mb-4">
                    <FaTasks className="text-xl text-[var(--accent)]" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Gestión de tareas</h3>
                  <p className="text-sm text-soft leading-relaxed">
                    Registra trabajos prácticos, parciales y entregas. Asigna prioridad,
                    fecha límite y materia para mantener todo organizado.
                  </p>
                </div>
              </article>

              {/* Tarjeta 2 */}
              <article className="group relative border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] hover:border-[var(--accent)]/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 mb-4">
                    <FaClock className="text-xl text-[var(--accent)]" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Técnica Pomodoro</h3>
                  <p className="text-sm text-soft leading-relaxed">
                    Temporizador integrado para sesiones de estudio enfocadas.
                    Registra automáticamente tu tiempo de concentración.
                  </p>
                </div>
              </article>

              {/* Tarjeta 3 */}
              <article className="group relative border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] hover:border-[var(--accent)]/50 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 mb-4">
                    <FaChartBar className="text-xl text-[var(--accent)]" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Métricas de estudio</h3>
                  <p className="text-sm text-soft leading-relaxed">
                    Visualiza minutos de enfoque, rachas de estudio y tareas
                    completadas para medir tu avance real.
                  </p>
                </div>
              </article>
            </div>

            {/* Características secundarias */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/50">
                <FaCalendarAlt className="text-[var(--primary-soft)]" />
                <span className="text-sm font-medium">Calendario</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/50">
                <FaBook className="text-[var(--primary-soft)]" />
                <span className="text-sm font-medium">Materias</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/50">
                <FaFire className="text-[var(--primary-soft)]" />
                <span className="text-sm font-medium">Rachas</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]/50">
                <FaCheckCircle className="text-[var(--primary-soft)]" />
                <span className="text-sm font-medium">Logros</span>
              </div>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <header className="text-center mb-12">
              <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider mb-4">
                Simple y efectivo
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Empieza en 3 pasos
              </h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--foreground)] text-xl font-bold mb-4">
                  1
                </div>
                <h3 className="font-semibold mb-2">Crea tu cuenta</h3>
                <p className="text-sm text-soft">
                  Registrate gratis y configura tus materias del cuatrimestre.
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--foreground)] text-xl font-bold mb-4">
                  2
                </div>
                <h3 className="font-semibold mb-2">Agrega tus tareas</h3>
                <p className="text-sm text-soft">
                  Carga entregas, parciales y trabajos con sus fechas límite.
                </p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--foreground)] text-xl font-bold mb-4">
                  3
                </div>
                <h3 className="font-semibold mb-2">Estudia y progresa</h3>
                <p className="text-sm text-soft">
                  Usa el Pomodoro, completa tareas y mira tu rendimiento crecer.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ACERCA DE */}
        <section className="px-4 py-16 bg-[var(--card-bg)]/30">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider mb-4">
              Acerca de
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">
              Una herramienta hecha para estudiantes
            </h2>
            <p className="text-soft leading-relaxed mb-4">
              Taskademic nace de la necesidad de centralizar la cursada en un solo lugar,
              priorizando una experiencia simple y rápida para estudiantes universitarios
              y terciarios.
            </p>
            <p className="text-muted leading-relaxed">
              El objetivo es reducir la fricción diaria, evitando depender de múltiples
              aplicaciones para organizar entregas, calendarios y sesiones de estudio.
            </p>
          </div>
        </section>

        {/* CONTACTO */}
        <section className="px-4 py-16">
          <div className="max-w-xl mx-auto">
            <header className="text-center mb-8">
              <span className="inline-block px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold uppercase tracking-wider mb-4">
                Contacto
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                ¿Tienes alguna consulta?
              </h2>
              <p className="text-soft">
                Envíanos un mensaje y te responderemos a la brevedad.
              </p>
            </header>

            <form
              className="flex flex-col gap-4 p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]"
              onSubmit={(e) => {
                e.preventDefault();
                alert('Mensaje enviado (placeholder)');
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Correo electrónico</span>
                <div className="relative">
                  <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm" />
                  <input
                    type="email"
                    required
                    placeholder="correo@ejemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--card-border)] text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Mensaje</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Escriba su consulta..."
                  className="w-full px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
                />
              </label>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity mt-2"
              >
                Enviar mensaje
              </button>

              <p className="text-[11px] text-muted text-center">
                Próximamente se habilitará el envío real de correos.
              </p>
            </form>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-4 py-16">
          <div className="max-w-3xl mx-auto text-center p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[var(--accent)]/20 via-[var(--primary-soft)]/10 to-[var(--card-bg)] border border-[var(--card-border)]">
            <FaRocket className="text-4xl text-[var(--accent)] mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Empieza a organizar tu cursada hoy
            </h2>
            <p className="text-soft mb-6">
              Únete gratis y toma el control de tu vida académica.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-lg shadow-[var(--accent)]/25 hover:shadow-xl transition-all"
            >
              Crear cuenta gratis
              <FaArrowRight className="text-sm" />
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // ================================
  // DASHBOARD CON SESIÓN
  // ================================
  return (
    <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header con saludo */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--card-border)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            {greeting} 👋
          </h1>
          <p className="text-soft">
            Aquí tienes un resumen de tu semana académica.
          </p>
        </div>
        <Link
          href="/tasks?new=true"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <FaTasks className="text-xs" />
          Nueva tarea
        </Link>
      </header>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
          <FaExclamationTriangle />
          {error}
        </div>
      )}

      {/* Tarjetas de métricas */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tareas pendientes */}
        <Link href="/tasks" className="group">
          <article className="h-full border border-[var(--card-border)] rounded-2xl p-5 bg-[var(--card-bg)] hover:border-[var(--accent)]/50 transition-all duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Pendientes</p>
                <p className="text-4xl font-bold text-[var(--accent)]">{pendingCount}</p>
                <p className="text-sm text-soft mt-1">tareas por completar</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center group-hover:bg-[var(--accent)]/20 transition-colors">
                <FaTasks className="text-lg text-[var(--accent)]" />
              </div>
            </div>
          </article>
        </Link>

        {/* Tareas vencidas */}
        <Link href="/tasks" className="group">
          <article className={`h-full border rounded-2xl p-5 bg-[var(--card-bg)] transition-all duration-200 ${overdueCount > 0 ? 'border-[var(--danger)]/30 hover:border-[var(--danger)]/50' : 'border-[var(--card-border)] hover:border-[var(--success)]/50'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Vencidas</p>
                  {overdueCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[var(--danger)]/15 text-[var(--danger)]">
                      !
                    </span>
                  )}
                </div>
                <p className={`text-4xl font-bold ${overdueCount > 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                  {overdueCount}
                </p>
                <p className="text-sm text-soft mt-1">
                  {overdueCount > 0 ? 'requieren atención' : 'todo al día'}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${overdueCount > 0 ? 'bg-[var(--danger)]/10 group-hover:bg-[var(--danger)]/20' : 'bg-[var(--success)]/10 group-hover:bg-[var(--success)]/20'}`}>
                {overdueCount > 0 ? (
                  <FaExclamationTriangle className="text-lg text-[var(--danger)]" />
                ) : (
                  <FaCheckCircle className="text-lg text-[var(--success)]" />
                )}
              </div>
            </div>
          </article>
        </Link>

        {/* Minutos de enfoque */}
        <Link href="/performance" className="group">
          <article className="h-full border border-[var(--card-border)] rounded-2xl p-5 bg-[var(--card-bg)] hover:border-[var(--primary-soft)]/50 transition-all duration-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Enfoque</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-4xl font-bold text-[var(--primary-soft)]">{focusLast7}</p>
                  <span className="text-sm text-muted">min</span>
                </div>
                <p className="text-sm text-soft mt-1">últimos 7 días</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft)]/10 flex items-center justify-center group-hover:bg-[var(--primary-soft)]/20 transition-colors">
                <FaClock className="text-lg text-[var(--primary-soft)]" />
              </div>
            </div>
          </article>
        </Link>
      </section>

      {/* Gráfico y Accesos rápidos en grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico - ocupa 2 columnas */}
        <section className="lg:col-span-2 border border-[var(--card-border)] rounded-2xl p-5 bg-[var(--card-bg)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent)]/15">
                <FaChartBar className="text-sm text-[var(--accent)]" />
              </div>
              <h2 className="font-semibold">Tiempo de estudio</h2>
            </div>
            <span className="text-xs text-muted">Últimos 7 días</span>
          </div>

          {dashboardLoading ? (
            <div className="h-52 flex items-center justify-center">
              <p className="text-sm text-muted">Cargando datos...</p>
            </div>
          ) : dailyFocus.every((p) => p.minutes === 0) ? (
            <div className="h-52 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--card-border)] flex items-center justify-center">
                <FaClock className="text-muted" />
              </div>
              <div>
                <p className="text-sm text-soft mb-1">Sin sesiones registradas</p>
                <p className="text-xs text-muted">Inicia un Pomodoro para ver tu progreso aquí</p>
              </div>
              <Link
                href="/pomodoro"
                className="inline-flex items-center gap-2 text-xs text-[var(--accent)] hover:underline mt-2"
              >
                Iniciar Pomodoro <FaArrowRight className="text-[10px]" />
              </Link>
            </div>
          ) : (
            <div className="w-full h-52 [&_*]:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyFocus}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="minutes" fill={barFill} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Accesos rápidos - columna lateral */}
        <section className="border border-[var(--card-border)] rounded-2xl p-5 bg-[var(--card-bg)]">
          <h2 className="font-semibold mb-4">Accesos rápidos</h2>
          <div className="flex flex-col gap-3">
            <Link
              href="/tasks"
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all"
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent)]/15 group-hover:bg-[var(--accent)]/25 transition-colors">
                <FaTasks className="text-[var(--accent)] text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Mis tareas</p>
                <p className="text-[11px] text-muted truncate">Gestionar pendientes</p>
              </div>
              <FaArrowRight className="text-xs text-muted group-hover:text-[var(--accent)] transition-colors" />
            </Link>

            <Link
              href="/pomodoro"
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all"
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--danger)]/15 group-hover:bg-[var(--danger)]/25 transition-colors">
                <FaClock className="text-[var(--danger)] text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Pomodoro</p>
                <p className="text-[11px] text-muted truncate">Iniciar sesión de estudio</p>
              </div>
              <FaArrowRight className="text-xs text-muted group-hover:text-[var(--accent)] transition-colors" />
            </Link>

            <Link
              href="/calendar"
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all"
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--primary-soft)]/15 group-hover:bg-[var(--primary-soft)]/25 transition-colors">
                <FaCalendarAlt className="text-[var(--primary-soft)] text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Calendario</p>
                <p className="text-[11px] text-muted truncate">Ver tareas en el tiempo</p>
              </div>
              <FaArrowRight className="text-xs text-muted group-hover:text-[var(--accent)] transition-colors" />
            </Link>

            <Link
              href="/performance"
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 transition-all"
            >
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--success)]/15 group-hover:bg-[var(--success)]/25 transition-colors">
                <FaChartBar className="text-[var(--success)] text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Rendimiento</p>
                <p className="text-[11px] text-muted truncate">Estadísticas y logros</p>
              </div>
              <FaArrowRight className="text-xs text-muted group-hover:text-[var(--accent)] transition-colors" />
            </Link>
          </div>
        </section>
      </div>

      {/* Próximas tareas */}
      <section className="border border-[var(--card-border)] rounded-2xl p-5 bg-[var(--card-bg)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent)]/15">
              <FaFire className="text-sm text-[var(--accent)]" />
            </div>
            <h2 className="font-semibold">Próximas tareas</h2>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="text-xs border border-[var(--card-border)] rounded-lg px-3 py-1.5 bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              value={upcomingPriorityFilter}
              onChange={(e) =>
                setUpcomingPriorityFilter(e.target.value as PriorityFilter)
              }
            >
              <option value="all">Todas las prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <Link
              href="/tasks"
              className="text-xs text-[var(--accent)] hover:underline hidden sm:inline"
            >
              Ver todas
            </Link>
          </div>
        </div>

        {dashboardLoading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted">Cargando tareas...</p>
          </div>
        ) : !hasData ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--card-border)] flex items-center justify-center">
              <FaTasks className="text-xl text-muted" />
            </div>
            <div>
              <p className="text-soft mb-1">Aún no tienes tareas</p>
              <p className="text-xs text-muted">Crea tu primera tarea para empezar a organizarte</p>
            </div>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded-lg bg-[var(--accent)] text-[var(--foreground)] text-sm font-medium"
            >
              Crear tarea
            </Link>
          </div>
        ) : upcomingTasks.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted">
              No hay tareas pendientes para la prioridad seleccionada.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {upcomingTasks.map((t) => {
              const p = t.priority ?? 'medium';
              const config = PRIORITY_CONFIG[p];
              const isOverdue = t.due_date && t.due_date < todayStr;

              return (
                <article
                  key={t.id}
                  className={`flex flex-col gap-2 p-4 rounded-xl border ${isOverdue ? 'border-[var(--danger)]/40 bg-[var(--danger)]/5' : 'border-[var(--card-border)] bg-[var(--card-bg)]/50'} hover:border-[var(--accent)]/40 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm line-clamp-2 flex-1">{t.title}</h3>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text} ${config.border} border`}>
                      {config.icon}
                      {config.label}
                    </span>
                  </div>
                  {t.due_date && (
                    <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-[var(--danger)]' : 'text-muted'}`}>
                      <FaCalendarAlt className="text-[10px]" />
                      <span>
                        {isOverdue ? 'Vencida: ' : ''}
                        {new Date(t.due_date + 'T00:00:00').toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
