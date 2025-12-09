'use client';

import { useEffect, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  // tareas del usuario para vincular con el Pomodoro
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | 'none'>('none');

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar tareas pendientes del usuario
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      setTasksLoading(true);
      const { data, error } = await supabaseClient
        .from('tasks')
        .select('id, title, completed, due_date')
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

  // Efecto: descontar segundos
  useEffect(() => {
    if (!isRunning) return;
    if (!user) return;
    if (remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, user, remainingSeconds]);

  // Efecto: cuando llega a 0, se termina la fase
  useEffect(() => {
    if (!isRunning) return;
    if (remainingSeconds !== 0) return;
    if (!user) return;

    handlePhaseEnd(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, isRunning, mode, user]);

  const formattedTime = `${String(
    Math.floor(remainingSeconds / 60),
  ).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  const handleStartPause = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setError(null);

    setIsRunning((prev) => {
      const next = !prev;

      // Al pasar a corriendo desde pausa, si es foco y no hay inicio marcado,
      // se guarda el inicio del ciclo
      if (next && mode === 'focus' && cycleStart === null) {
        setCycleStart(Date.now());
      }

      return next;
    });
  };

  const handleReset = () => {
    const initialSeconds =
      mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
    setRemainingSeconds(initialSeconds);
    setIsRunning(false);
    setCycleStart(null);
    setError(null);
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
  };

  // Fin de fase (foco o descanso)
  const handlePhaseEnd = async (finishedMode: Mode) => {
    if (!user) return;

    // Si terminó un ciclo de ENFOQUE, se registra sesión
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

        const { error } = await supabaseClient
          .from('pomodoro_sessions')
          .insert({
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

    // Si se mantiene corriendo y se vuelve a foco, marcar nuevo inicio
    if (isRunning && nextMode === 'focus') {
      setCycleStart(Date.now());
    } else {
      setCycleStart(null);
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

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}
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
          <h3 className="font-semibold mb-2 text-sm">
            Vincular con una tarea
          </h3>

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
