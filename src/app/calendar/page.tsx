// src/app/calendar/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';

type Priority = 'low' | 'medium' | 'high';

type Task = {
  id: string;
  title: string;
  due_date: string | null; // YYYY-MM-DD
  completed: boolean;
  course_id: string | null;
  priority: Priority | null;
};

type Session = {
  id: string;
  started_at: string;
  duration_minutes: number;
};

type Course = {
  id: string;
  name: string;
  color: string | null;
};

type DayInfo = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  tasks: Task[];
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

const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'var(--danger)',
  medium: 'var(--warn)',
  low: 'var(--success)',
};

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-11

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [coursesMap, setCoursesMap] = useState<Map<string, Course>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar tareas, sesiones y materias en paralelo
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingData(true);
      setError(null);

      const [tasksResult, sessionsResult, coursesResult] = await Promise.all([
        supabaseClient
          .from('tasks')
          .select('id, title, due_date, completed, course_id, priority')
          .eq('user_id', user.id),
        supabaseClient
          .from('pomodoro_sessions')
          .select('id, started_at, duration_minutes')
          .eq('user_id', user.id),
        supabaseClient
          .from('courses')
          .select('id, name, color')
          .eq('user_id', user.id),
      ]);

      if (tasksResult.error) {
        setError('No se pudieron cargar las tareas.');
      } else {
        setTasks((tasksResult.data ?? []) as Task[]);
      }

      if (!sessionsResult.error) {
        setSessions((sessionsResult.data ?? []) as Session[]);
      }

      if (!coursesResult.error) {
        const map = new Map<string, Course>(
          ((coursesResult.data ?? []) as Course[]).map((c) => [c.id, c]),
        );
        setCoursesMap(map);
      }

      setLoadingData(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Construir mapa de día -> info (con array de tareas completo)
  const daysInfo = useMemo(() => {
    const matrix = getMonthMatrix(year, month);
    const map = new Map<string, DayInfo>();

    matrix.forEach((dateStr) => {
      if (!dateStr) return;
      const dayNumber = parseInt(dateStr.slice(8, 10), 10);
      map.set(dateStr, { date: dateStr, dayNumber, tasks: [], minutesFocus: 0 });
    });

    tasks.forEach((t) => {
      if (!t.due_date) return;
      const info = map.get(t.due_date);
      if (!info) return;
      info.tasks.push(t);
    });

    sessions.forEach((s) => {
      const dayKey = new Date(s.started_at).toISOString().slice(0, 10);
      const info = map.get(dayKey);
      if (!info) return;
      info.minutesFocus += s.duration_minutes || 0;
    });

    return matrix.map((dateStr) => (dateStr ? map.get(dateStr)! : null));
  }, [year, month, tasks, sessions]);

  // Datos del día seleccionado
  const selectedDayTasks = useMemo(
    () => (selectedDate ? tasks.filter((t) => t.due_date === selectedDate) : []),
    [selectedDate, tasks],
  );

  const selectedDaySessions = useMemo(
    () =>
      selectedDate
        ? sessions.filter(
            (s) => new Date(s.started_at).toISOString().slice(0, 10) === selectedDate,
          )
        : [],
    [selectedDate, sessions],
  );

  const selectedDayMinutes = selectedDaySessions.reduce(
    (acc, s) => acc + (s.duration_minutes || 0),
    0,
  );

  // Toggle completado de una tarea (optimista)
  const toggleTask = useCallback(
    async (taskId: string, current: boolean) => {
      setToggling(taskId);
      const { error } = await supabaseClient
        .from('tasks')
        .update({ completed: !current })
        .eq('id', taskId);
      if (!error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, completed: !current } : t)),
        );
      }
      setToggling(null);
    },
    [],
  );

  const monthLabel = new Date(year, month, 1).toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const goPrevMonth = () => {
    setError(null);
    setSelectedDate(null);
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
    setSelectedDate(null);
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
  const monthStats = {
    totalTasks: daysInfo.reduce((acc, d) => acc + (d?.tasks.length ?? 0), 0),
    totalMinutes: daysInfo.reduce((acc, d) => acc + (d?.minutesFocus ?? 0), 0),
    daysWithActivity: daysInfo.filter(
      (d) => d && (d.tasks.length > 0 || d.minutesFocus > 0),
    ).length,
  };

  // Label formateado del día seleccionado
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

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
                  return <div key={idx} className="aspect-square rounded-xl bg-transparent" />;
                }

                const isToday = info.date === todayStr;
                const isSelected = info.date === selectedDate;

                return (
                  <div
                    key={info.date}
                    onClick={() =>
                      setSelectedDate((prev) => (prev === info.date ? null : info.date))
                    }
                    className={`
                      aspect-square rounded-xl border p-2 flex flex-col transition-all duration-200 cursor-pointer
                      ${isToday
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/30'
                        : isSelected
                          ? 'border-[var(--primary-soft)] bg-[var(--primary-soft)]/10 ring-1 ring-[var(--primary-soft)]/30'
                          : 'border-[var(--card-border)] bg-[var(--background)] hover:border-[var(--primary-soft)]/50'
                      }
                    `}
                  >
                    {/* Número del día */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isToday ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                        {info.dayNumber}
                      </span>
                      {isToday && <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
                    </div>

                    {/* Indicadores */}
                    <div className="flex-1 flex flex-col justify-end gap-1">
                      {/* Puntos de color por materia */}
                      {info.tasks.length > 0 && (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {info.tasks.slice(0, 3).map((t) => {
                            const course = t.course_id ? coursesMap.get(t.course_id) : null;
                            return (
                              <span
                                key={t.id}
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  backgroundColor: course?.color || 'var(--accent)',
                                  opacity: t.completed ? 0.35 : 1,
                                }}
                              />
                            );
                          })}
                          {info.tasks.length > 3 && (
                            <span className="text-[8px] text-[var(--text-muted)] font-bold leading-none">
                              +{info.tasks.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Minutos de enfoque */}
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

      {/* Panel del día seleccionado */}
      {selectedDate && (
        <section className="border border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)] overflow-hidden">
          {/* Header del panel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--card-border)]">
            <div>
              <p className="font-semibold text-[var(--foreground)] capitalize">{selectedDateLabel}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'tarea' : 'tareas'}
                {selectedDayMinutes > 0 && ` · ${selectedDayMinutes} min de enfoque`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/tasks?date=${selectedDate}`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent)]/20 transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva tarea
              </button>
              <button
                onClick={() => setSelectedDate(null)}
                aria-label="Cerrar panel"
                className="p-2 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Lista de tareas */}
          <div className="px-5 py-4">
            {selectedDayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-[var(--background)]/60 border border-dashed border-[var(--card-border)]">
                <svg className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm text-[var(--text-muted)]">Sin tareas para este día</p>
                <button
                  onClick={() => router.push(`/tasks?date=${selectedDate}`)}
                  className="mt-3 text-xs text-[var(--accent)] hover:underline font-medium"
                >
                  Crear una tarea
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedDayTasks.map((task) => {
                  const course = task.course_id ? coursesMap.get(task.course_id) : null;
                  const isToggling = toggling === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                        task.completed
                          ? 'border-[var(--card-border)] bg-[var(--background)]/40 opacity-60'
                          : 'border-[var(--card-border)] bg-[var(--background)]'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleTask(task.id, task.completed)}
                        disabled={isToggling}
                        aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                        className="shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 disabled:opacity-50"
                        style={{
                          borderColor: task.completed ? 'var(--success)' : 'var(--card-border)',
                          backgroundColor: task.completed ? 'var(--success)' : 'transparent',
                        }}
                      >
                        {isToggling ? (
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : task.completed ? (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </button>

                      {/* Punto de color de materia */}
                      {course && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: course.color || 'var(--accent)' }}
                          title={course.name}
                        />
                      )}

                      {/* Título */}
                      <span
                        className={`flex-1 text-sm font-medium min-w-0 truncate ${
                          task.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--foreground)]'
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {course && (
                          <span className="text-[10px] text-[var(--text-muted)] hidden sm:block">
                            {course.name}
                          </span>
                        )}
                        {task.priority && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${PRIORITY_COLORS[task.priority]}22`,
                              color: PRIORITY_COLORS[task.priority],
                            }}
                          >
                            {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sesiones Pomodoro del día */}
            {selectedDaySessions.length > 0 && (
              <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-[var(--success)]/8 border border-[var(--success)]/20">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)] shrink-0" />
                <p className="text-sm text-[var(--success)] font-medium">
                  {selectedDayMinutes} min de enfoque · {selectedDaySessions.length}{' '}
                  {selectedDaySessions.length === 1 ? 'sesión Pomodoro' : 'sesiones Pomodoro'}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Leyenda */}
      <section className="flex flex-wrap justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[var(--accent)]" />
          <span className="text-[var(--text-muted)]">Tareas (color = materia)</span>
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
