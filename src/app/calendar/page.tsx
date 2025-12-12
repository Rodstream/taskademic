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
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-sm text-gray-400">
            Visualice tareas y tiempo de estudio por día.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={goPrevMonth}
            className="px-2 py-1 border border-[var(--card-border)] rounded-md hover:bg-white/10"
          >
            «
          </button>
          <span className="font-semibold capitalize">
            {monthLabel}
          </span>
          <button
            onClick={goNextMonth}
            className="px-2 py-1 border border-[var(--card-border)] rounded-md hover:bg-white/10"
          >
            »
          </button>
        </div>
      </header>

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      <section className="border border-[var(--card-border)] rounded-xl p-3 bg-[var(--card-bg)]">
        {loadingData ? (
          <p>Cargando datos...</p>
        ) : (
          <>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400 mb-2">
              {weekdays.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs">
              {daysInfo.map((info, idx) => {
              if (!info) {
                return (
                  <div
                    key={idx}
                    className="h-20 rounded-md bg-transparent"
                  />
                );
              }
            
              const isToday =
                info.date === new Date().toISOString().slice(0, 10);
            
              return (
                <div
                  key={info.date}
                  className={`
                    h-20 rounded-md border border-[var(--card-border)]
                    px-1.5 py-1 flex flex-col justify-between
                    bg-[var(--card-bg)]
                    ${isToday ? 'ring-1 ring-[var(--accent)]' : ''}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold">
                      {info.dayNumber}
                    </span>
                  </div>
                
                  <div className="space-y-1">
                    {info.tasksDue > 0 && (
                      <p className="text-[10px] text-[var(--accent)]">
                        Tareas: {info.tasksDue}
                      </p>
                    )}
                    {info.minutesFocus > 0 && (
                      <p className="text-[10px] text-[var(--success)]">
                        Min Pomodoro: {info.minutesFocus}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </section>

      <section className="mt-4 text-xs text-gray-400 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-[var(--accent)]" />
          <span>Tareas con fecha límite ese día</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-400" />
          <span>Minutos de enfoque registrados ese día</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full border border-[var(--accent)]" />
          <span>Día actual</span>
        </div>
      </section>
    </main>
  );
}
