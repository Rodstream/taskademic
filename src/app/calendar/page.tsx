// src/app/calendar/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';

type Task = {
  id: string;
  title: string;
  due_date: string | null; // YYYY-MM-DD
  completed: boolean;
};

type Session = {
  id: string;
  started_at: string;
  duration_minutes: number;
};

type DayInfo = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  tasksDue: number;
  minutesFocus: number;
};

function getMonthMatrix(year: number, monthIndex: number): string[] {
  // monthIndex: 0-11
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); // 0-6 (domingo-sábado)

  const result: string[] = [];
  // relleno con días vacíos antes del 1
  for (let i = 0; i < startWeekday; i++) {
    result.push('');
  }
  // días reales
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d).toISOString().slice(0, 10);
    result.push(date);
  }

  // completar hasta múltiplo de 7
  while (result.length % 7 !== 0) {
    result.push('');
  }

  return result;
}

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar tareas y sesiones del usuario
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingData(true);
      setError(null);

      const { data: tasksData, error: tasksError } = await supabaseClient
        .from('tasks')
        .select('id, title, due_date, completed')
        .eq('user_id', user.id);

      if (tasksError) {
        setError('No se pudieron cargar las tareas.');
        return;
      } else {
        setTasks((tasksData ?? []) as Task[]);
      }
      

      const { data: sessionsData, error: sessionsError } = await supabaseClient
        .from('pomodoro_sessions')
        .select('id, started_at, duration_minutes')
        .eq('user_id', user.id);

      if (sessionsError) {
        console.error(sessionsError);
        if (!error) setError('No se pudieron cargar las sesiones de Pomodoro.');
      } else {
        setSessions((sessionsData ?? []) as Session[]);
      }

      setLoadingData(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Construir mapa de día -> info
  const daysInfo = useMemo(() => {
    const matrix = getMonthMatrix(year, month);
    const map = new Map<string, DayInfo>();

    matrix.forEach((dateStr) => {
      if (!dateStr) return;
      const dayNumber = parseInt(dateStr.slice(8, 10), 10);
      map.set(dateStr, {
        date: dateStr,
        dayNumber,
        tasksDue: 0,
        minutesFocus: 0,
      });
    });

    // tareas según due_date
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const info = map.get(t.due_date);
      if (!info) return;
      info.tasksDue += 1;
    });

    // sesiones según fecha de inicio
    sessions.forEach((s) => {
      const dayKey = new Date(s.started_at).toISOString().slice(0, 10);
      const info = map.get(dayKey);
      if (!info) return;
      info.minutesFocus += s.duration_minutes || 0;
    });

    return matrix.map((dateStr) =>
      dateStr ? map.get(dateStr)! : null,
    );
  }, [year, month, tasks, sessions]);

  const monthLabel = new Date(year, month, 1).toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const goPrevMonth = () => {
    setError(null);
    setLoadingData(false);
    const newMonth = month - 1;
    if (newMonth < 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth(newMonth);
    }
  };

  const goNextMonth = () => {
    setError(null);
    setLoadingData(false);
    const newMonth = month + 1;
    if (newMonth > 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth(newMonth);
    }
  };

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const todayStr = new Date().toISOString().slice(0, 10);

  // Stats del mes actual
  const monthStats = useMemo(() => {
    const totalTasks = daysInfo.filter(d => d && d.tasksDue > 0).reduce((acc, d) => acc + (d?.tasksDue || 0), 0);
    const totalMinutes = daysInfo.filter(d => d && d.minutesFocus > 0).reduce((acc, d) => acc + (d?.minutesFocus || 0), 0);
    const daysWithActivity = daysInfo.filter(d => d && (d.tasksDue > 0 || d.minutesFocus > 0)).length;
    return { totalTasks, totalMinutes, daysWithActivity };
  }, [daysInfo]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
          Calendario
        </h1>
        <p className="text-[var(--text-muted)] max-w-md mx-auto">
          Visualiza tus tareas y tiempo de estudio organizados por día
        </p>
      </header>

      {/* Navegación del mes */}
      <section className="flex items-center justify-center gap-4">
        <button
          onClick={goPrevMonth}
          className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="min-w-[200px] text-center">
          <h2 className="text-xl font-semibold text-[var(--foreground)] capitalize">
            {monthLabel}
          </h2>
        </div>

        <button
          onClick={goNextMonth}
          className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)] transition-all duration-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* Stats del mes */}
      <section className="grid grid-cols-3 gap-3">
        <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{monthStats.totalTasks}</p>
          <p className="text-xs text-[var(--text-muted)]">Tareas este mes</p>
        </div>

        <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--success)]/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{monthStats.totalMinutes}</p>
          <p className="text-xs text-[var(--text-muted)]">Minutos de enfoque</p>
        </div>

        <div className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[var(--primary-soft)]/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-[var(--primary-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[var(--foreground)]">{monthStats.daysWithActivity}</p>
          <p className="text-xs text-[var(--text-muted)]">Días con actividad</p>
        </div>
      </section>

      {error && (
        <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg text-center">
          {error}
        </p>
      )}

      {/* Calendario */}
      <section className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)] backdrop-blur-sm">
        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Días de la semana */}
            <div className="grid grid-cols-7 text-center mb-3">
              {weekdays.map((d) => (
                <div key={d} className="py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid de días */}
            <div className="grid grid-cols-7 gap-2">
              {daysInfo.map((info, idx) => {
                if (!info) {
                  return (
                    <div key={idx} className="aspect-square rounded-xl bg-transparent" />
                  );
                }

                const isToday = info.date === todayStr;

                return (
                  <div
                    key={info.date}
                    className={`
                      aspect-square rounded-xl border p-2 flex flex-col transition-all duration-200
                      ${isToday
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/30'
                        : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]/50'
                      }
                    `}
                  >
                    {/* Número del día */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                        {info.dayNumber}
                      </span>
                      {isToday && (
                        <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                      )}
                    </div>

                    {/* Indicadores */}
                    <div className="flex-1 flex flex-col justify-end gap-1">
                      {info.tasksDue > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                          <span className="text-[10px] text-[var(--accent)] font-medium">
                            {info.tasksDue} {info.tasksDue === 1 ? 'tarea' : 'tareas'}
                          </span>
                        </div>
                      )}
                      {info.minutesFocus > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                          <span className="text-[10px] text-[var(--success)] font-medium">
                            {info.minutesFocus} min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Leyenda */}
      <section className="flex flex-wrap justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--accent)]" />
          <span className="text-[var(--text-muted)]">Tareas programadas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--success)]" />
          <span className="text-[var(--text-muted)]">Tiempo de enfoque</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)]/20" />
          <span className="text-[var(--text-muted)]">Día actual</span>
        </div>
      </section>
    </main>
  );
}
