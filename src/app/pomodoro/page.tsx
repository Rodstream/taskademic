// src/app/pomodoro/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';

type Mode = 'focus' | 'break';

type Task = {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
};

const FOCUS_MINUTES_DEFAULT = 25;
const BREAK_MINUTES_DEFAULT = 5;

const STORAGE_KEY = 'taskademic:pomodoro:v1';

type StoredState = {
  mode: Mode;
  remainingSeconds: number;
  isRunning: boolean;
  focusMinutes: number;
  breakMinutes: number;
  focusInput: string;
  breakInput: string;
  cycleStart: number | null;
  selectedTaskId: string | 'none';
  lastTickAt: number | null; // epoch ms: para descontar tiempo aunque cambies de página
};

export default function PomodoroPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('focus');
  const [remainingSeconds, setRemainingSeconds] = useState(
    FOCUS_MINUTES_DEFAULT * 60,
  );
  const [isRunning, setIsRunning] = useState(false);

  const [focusMinutes, setFocusMinutes] = useState(FOCUS_MINUTES_DEFAULT);
  const [breakMinutes, setBreakMinutes] = useState(BREAK_MINUTES_DEFAULT);

  const [focusInput, setFocusInput] = useState(
    FOCUS_MINUTES_DEFAULT.toString(),
  );
  const [breakInput, setBreakInput] = useState(
    BREAK_MINUTES_DEFAULT.toString(),
  );

  const [cycleStart, setCycleStart] = useState<number | null>(null);
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  // tareas del usuario para vincular con el Pomodoro
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | 'none'>('none');

  // evita pisar localStorage con defaults
  const [hydrated, setHydrated] = useState(false);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Hidratar desde localStorage (solo una vez cuando hay user)
  useEffect(() => {
    if (!user) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const saved = JSON.parse(raw) as Partial<StoredState>;

      const savedMode = (saved.mode ?? 'focus') as Mode;
      const savedRemaining =
        typeof saved.remainingSeconds === 'number'
          ? saved.remainingSeconds
          : FOCUS_MINUTES_DEFAULT * 60;

      const savedRunning = !!saved.isRunning;

      const savedFocusMin =
        typeof saved.focusMinutes === 'number'
          ? saved.focusMinutes
          : FOCUS_MINUTES_DEFAULT;

      const savedBreakMin =
        typeof saved.breakMinutes === 'number'
          ? saved.breakMinutes
          : BREAK_MINUTES_DEFAULT;

      const savedFocusInput =
        typeof saved.focusInput === 'string'
          ? saved.focusInput
          : String(savedFocusMin);

      const savedBreakInput =
        typeof saved.breakInput === 'string'
          ? saved.breakInput
          : String(savedBreakMin);

      const savedCycleStart =
        typeof saved.cycleStart === 'number' ? saved.cycleStart : null;

      const savedSelected =
        typeof saved.selectedTaskId === 'string' ? saved.selectedTaskId : 'none';

      const savedLastTickAt =
        typeof saved.lastTickAt === 'number' ? saved.lastTickAt : null;

      // Aplicar “catch-up” si estaba corriendo
      let nextRemaining = Math.max(0, savedRemaining);
      if (savedRunning && savedLastTickAt) {
        const elapsedSec = Math.floor((Date.now() - savedLastTickAt) / 1000);
        if (elapsedSec > 0) nextRemaining = Math.max(0, nextRemaining - elapsedSec);
      }

      setMode(savedMode);
      setRemainingSeconds(nextRemaining);
      setIsRunning(savedRunning);
      setFocusMinutes(savedFocusMin);
      setBreakMinutes(savedBreakMin);
      setFocusInput(savedFocusInput);
      setBreakInput(savedBreakInput);
      setCycleStart(savedCycleStart);
      setSelectedTaskId(savedSelected);

      // si estaba corriendo, resetea lastTickAt a “ahora” para seguir descontando
      setLastTickAt(savedRunning ? Date.now() : null);
    } catch {
      // si el storage está corrupto, ignorar y seguir con defaults
    } finally {
      setHydrated(true);
    }
  }, [user]);

  // Persistir a localStorage (solo después de hidratar)
  useEffect(() => {
    if (!user) return;
    if (!hydrated) return;

    const toSave: StoredState = {
      mode,
      remainingSeconds,
      isRunning,
      focusMinutes,
      breakMinutes,
      focusInput,
      breakInput,
      cycleStart,
      selectedTaskId,
      lastTickAt,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [
    user,
    hydrated,
    mode,
    remainingSeconds,
    isRunning,
    focusMinutes,
    breakMinutes,
    focusInput,
    breakInput,
    cycleStart,
    selectedTaskId,
    lastTickAt,
  ]);

  // Cargar tareas pendientes del usuario
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      setTasksLoading(true);

      const { data, error } = await supabaseClient
        .from('tasks')
        .select('id, title, completed, due_date')
        // .eq('user_id', user.id)
        .eq('completed', false)
        .order('due_date', { ascending: true });

      if (error) {
        console.error(error);
        setError('No se pudieron cargar las tareas para el Pomodoro.');
      } else {
        const list = (data ?? []) as Task[];
        setTasks(list);

        // si no hay tarea seleccionada, elegir la primera
        if (list.length > 0 && selectedTaskId === 'none') {
          setSelectedTaskId(list[0].id);
        }
      }

      setTasksLoading(false);
    };

    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Tick: descontar segundos + actualizar lastTickAt
  useEffect(() => {
    if (!isRunning) return;
    if (!user) return;
    if (remainingSeconds <= 0) return;

    // setear lastTickAt si arranca a correr y estaba null
    if (!lastTickAt) setLastTickAt(Date.now());

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
      setLastTickAt(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, user, remainingSeconds, lastTickAt]);

  // Cuando llega a 0, termina la fase
  useEffect(() => {
    if (!isRunning) return;
    if (remainingSeconds !== 0) return;
    if (!user) return;

    handlePhaseEnd(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, isRunning, mode, user]);

  const formattedTime = useMemo(() => {
    const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const ss = String(remainingSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, [remainingSeconds]);

  const handleStartPause = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setError(null);

    setIsRunning((prev) => {
      const next = !prev;

      if (next) {
        // arrancó
        setLastTickAt(Date.now());

        // si es foco y no hay inicio marcado, guardar inicio
        if (mode === 'focus' && cycleStart === null) {
          setCycleStart(Date.now());
        }
      } else {
        // pausó
        setLastTickAt(null);
      }

      return next;
    });
  };

  /**
   * Guarda el progreso de foco aunque el ciclo NO haya terminado.
   * Se usa para el botón "Reiniciar" (y puede reutilizarse en otros flujos).
   */
  const flushFocusProgress = async () => {
    if (!user) return;
    if (mode !== 'focus') return;

    const totalFocusSeconds = focusMinutes * 60;
    const workedSeconds = Math.max(0, Math.min(totalFocusSeconds, totalFocusSeconds - remainingSeconds));
    const workedMinutes = Math.floor(workedSeconds / 60);

    // Si no llegó a 1 minuto completo, no se registra nada para evitar ruido.
    if (workedMinutes <= 0) return;

    const end = Date.now();

    // Si no hay cycleStart (caso raro), se aproxima el inicio en base a lo trabajado.
    const startedAtMs =
      typeof cycleStart === 'number' ? cycleStart : end - workedMinutes * 60_000;

    const taskIdToSave =
      selectedTaskId && selectedTaskId !== 'none' ? selectedTaskId : null;

    const { error } = await supabaseClient.from('pomodoro_sessions').insert({
      user_id: user.id,
      started_at: new Date(startedAtMs).toISOString(),
      ended_at: new Date(end).toISOString(),
      duration_minutes: workedMinutes,
      task_id: taskIdToSave,
    });

    if (error) {
      console.error(error);
      setError('No se pudo registrar el progreso del Pomodoro al reiniciar.');
    }
  };

  const handleReset = async () => {
    setError(null);

    // ✅ FIX: si está en foco y ya trabajó minutos, se guardan antes de resetear
    try {
      await flushFocusProgress();
    } catch (e) {
      console.error(e);
      setError('Ocurrió un error al guardar el progreso antes de reiniciar.');
      // si falla el guardado, igualmente se permite reiniciar para no bloquear UX
    }

    const initialSeconds =
      mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;

    setRemainingSeconds(initialSeconds);
    setIsRunning(false);
    setCycleStart(null);
    setLastTickAt(null);
  };

  const handleApplyDurations = () => {
    const focus = parseInt(focusInput) || FOCUS_MINUTES_DEFAULT;
    const brk = parseInt(breakInput) || BREAK_MINUTES_DEFAULT;

    setFocusMinutes(focus);
    setBreakMinutes(brk);

    const initialSeconds = mode === 'focus' ? focus * 60 : brk * 60;
    setRemainingSeconds(initialSeconds);

    setIsRunning(false);
    setCycleStart(null);
    setLastTickAt(null);
    setError(null);
  };

  // Fin de fase (foco o descanso)
  const handlePhaseEnd = async (finishedMode: Mode) => {
    if (!user) return;

    // Si terminó un ciclo de ENFOQUE, se registra sesión (igual que antes)
    if (finishedMode === 'focus' && cycleStart !== null) {
      try {
        const end = Date.now();
        const durationMinutes = Math.max(
          1,
          Math.round((end - cycleStart) / 60000),
        );

        const taskIdToSave =
          selectedTaskId && selectedTaskId !== 'none'
            ? selectedTaskId
            : null;

        const { error } = await supabaseClient.from('pomodoro_sessions').insert({
          user_id: user.id,
          started_at: new Date(cycleStart).toISOString(),
          ended_at: new Date(end).toISOString(),
          duration_minutes: durationMinutes,
          task_id: taskIdToSave,
        });

        if (error) {
          console.error(error);
          setError('No se pudo registrar la sesión de Pomodoro.');
        }
      } catch (e) {
        console.error(e);
        setError('Ocurrió un error al registrar la sesión.');
      }
    }

    // Cambiar de modo
    const nextMode: Mode = finishedMode === 'focus' ? 'break' : 'focus';
    const nextSeconds =
      nextMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;

    setMode(nextMode);
    setRemainingSeconds(nextSeconds);

    if (isRunning) {
      // si sigue corriendo, reiniciar tickAt
      setLastTickAt(Date.now());

      // si vuelve a foco, marcar nuevo inicio
      if (nextMode === 'focus') setCycleStart(Date.now());
      else setCycleStart(null);
    } else {
      setCycleStart(null);
      setLastTickAt(null);
    }
  };

  const activeTask =
    selectedTaskId === 'none'
      ? null
      : tasks.find((t) => t.id === selectedTaskId) ?? null;

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  // opcional: evitar “parpadeo” mientras hidrata
  if (!hydrated) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando Pomodoro...</p>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Modo Pomodoro</h1>

      <section className="border border-[var(--card-border)] rounded-lg p-4 mb-6 flex flex-col gap-4 bg-[var(--card-bg)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Modo actual</p>
            <p className="text-lg font-semibold">
              {mode === 'focus' ? 'Enfoque' : 'Descanso'}
            </p>
          </div>
          <div className="text-4xl font-mono">{formattedTime}</div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleStartPause}
            className="px-4 py-2 border border-[var(--card-border)] rounded-md bg-[var(--primary)] text-white"
          >
            {isRunning ? 'Pausar' : 'Iniciar'}
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/10"
          >
            Reiniciar
          </button>
        </div>

        {activeTask ? (
          <div className="mt-1 text-sm">
            <p className="text-gray-400">Tarea actual</p>
            <p className="font-medium">{activeTask.title}</p>
            {activeTask.due_date && (
              <p className="text-xs text-gray-500">
                Fecha límite: {activeTask.due_date}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Las sesiones se registrarán sin tarea asociada.
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-4 text-sm bg-[var(--card-bg)]">
        <h2 className="font-semibold">Configuración</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span>Minutos de enfoque</span>
            <input
              type="number"
              min={1}
              className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 flex-1">
            <span>Minutos de descanso</span>
            <input
              type="number"
              min={1}
              className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              value={breakInput}
              onChange={(e) => setBreakInput(e.target.value)}
            />
          </label>
        </div>

        <button
          onClick={handleApplyDurations}
          className="self-start mt-1 px-4 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/10"
        >
          Aplicar tiempos
        </button>

        <div className="border-t border-[var(--card-border)] pt-3 mt-2">
          <h3 className="font-semibold mb-2 text-sm">Vincular con una tarea</h3>

          {tasksLoading ? (
            <p>Cargando tareas...</p>
          ) : tasks.length === 0 ? (
            <p className="text-xs text-gray-500">
              No hay tareas pendientes. Cree una desde la sección “Tareas”.
            </p>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">
                Las sesiones de enfoque se guardarán asociadas a esta tarea.
              </span>
              <select
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
              >
                <option value="none">Sin tarea asociada</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                    {t.due_date ? ` (vence: ${t.due_date})` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>
    </main>
  );
}
