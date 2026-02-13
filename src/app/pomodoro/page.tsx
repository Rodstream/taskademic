// src/app/pomodoro/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PremiumGate } from '@/components/PremiumGate';
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
  lastTickAt: number | null;
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

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | 'none'>('none');

  const [hydrated, setHydrated] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const remainingSecondsRef = useRef(remainingSeconds);
  const lastTickAtRef = useRef<number | null>(null);
  const stateRef = useRef<StoredState | null>(null);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    lastTickAtRef.current = lastTickAt;
  }, [lastTickAt]);

  useEffect(() => {
    stateRef.current = {
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
  }, [
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

  const persistState = useCallback(() => {
    if (!user) return;
    if (!hydrated) return;
    if (!stateRef.current) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
  }, [user, hydrated]);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Hidratar desde localStorage
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
      // Validar remainingSeconds con límites de seguridad (0 a 2 horas máx)
      const savedRemaining =
        typeof saved.remainingSeconds === 'number' &&
        saved.remainingSeconds >= 0 &&
        saved.remainingSeconds <= 7200
          ? saved.remainingSeconds
          : FOCUS_MINUTES_DEFAULT * 60;

      const savedRunning = !!saved.isRunning;

      // Validar focusMinutes con límites de seguridad (1-120 minutos)
      const savedFocusMin =
        typeof saved.focusMinutes === 'number' &&
        saved.focusMinutes >= 1 &&
        saved.focusMinutes <= 120
          ? saved.focusMinutes
          : FOCUS_MINUTES_DEFAULT;

      // Validar breakMinutes con límites de seguridad (1-60 minutos)
      const savedBreakMin =
        typeof saved.breakMinutes === 'number' &&
        saved.breakMinutes >= 1 &&
        saved.breakMinutes <= 60
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
      const nextTickAt = savedRunning ? Date.now() : null;
      setLastTickAt(nextTickAt);
      lastTickAtRef.current = nextTickAt;
    } catch {
      // storage corrupto, usar defaults
    } finally {
      setHydrated(true);
    }
  }, [user]);

  // Persistir cuando no corre (cambios puntuales)
  useEffect(() => {
    if (!user) return;
    if (!hydrated) return;
    if (isRunning) return;

    persistState();
  }, [
    user,
    hydrated,
    isRunning,
    mode,
    remainingSeconds,
    focusMinutes,
    breakMinutes,
    focusInput,
    breakInput,
    cycleStart,
    selectedTaskId,
    lastTickAt,
    persistState,
  ]);

  // Persistir con throttle mientras corre
  useEffect(() => {
    if (!user) return;
    if (!hydrated) return;
    if (!isRunning) return;

    persistState();
    const interval = setInterval(() => {
      persistState();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, hydrated, isRunning, persistState]);

  // Persistir al cerrar o al ocultar la pestana + corregir desfase al volver
  useEffect(() => {
    if (!user) return;
    if (!hydrated) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        persistState();
        return;
      }

      if (document.visibilityState === 'visible' && isRunning) {
        const now = Date.now();
        const prev = lastTickAtRef.current;

        if (typeof prev === 'number') {
          const elapsed = Math.floor((now - prev) / 1000);
          if (elapsed > 0) {
            lastTickAtRef.current = now;
            setLastTickAt(now);
            setRemainingSeconds((curr) => Math.max(0, curr - elapsed));
          }
        }
      }
    };

    const handleBeforeUnload = () => {
      persistState();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, hydrated, isRunning, persistState]);

  // Cargar tareas pendientes
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      setTasksLoading(true);

      const { data, error } = await supabaseClient
        .from('tasks')
        .select('id, title, completed, due_date')
        .eq('user_id', user.id)
        .eq('completed', false)
        .order('due_date', { ascending: true });

      if (error) {
        setError('No se pudieron cargar las tareas para el Pomodoro.');
      } else {
        const list = (data ?? []) as Task[];
        setTasks(list);
      }

      setTasksLoading(false);
    };

    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Tick del timer
  useEffect(() => {
    if (!isRunning) return;
    if (!user) return;
    if (remainingSecondsRef.current <= 0) return;

    if (!lastTickAtRef.current) {
      const now = Date.now();
      lastTickAtRef.current = now;
      setLastTickAt(now);
    }

    const interval = setInterval(() => {
      if (remainingSecondsRef.current <= 0) {
        clearInterval(interval);
        return;
      }

      const now = Date.now();
      const prevTick = lastTickAtRef.current ?? now;
      const deltaSec = Math.max(1, Math.floor((now - prevTick) / 1000));

      lastTickAtRef.current = now;
      setLastTickAt(now);
      setRemainingSeconds((prev) => Math.max(0, prev - deltaSec));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, user]);

  // Fin de fase
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

  // Progreso circular (0 a 1)
  const progress = useMemo(() => {
    const totalSeconds = mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
    if (totalSeconds === 0) return 0;
    return 1 - remainingSeconds / totalSeconds;
  }, [remainingSeconds, mode, focusMinutes, breakMinutes]);

  const handleStartPause = () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setError(null);

    setIsRunning((prev) => {
      const next = !prev;

      if (next) {
        const now = Date.now();
        lastTickAtRef.current = now;
        setLastTickAt(now);
        if (mode === 'focus' && cycleStart === null) {
          setCycleStart(now);
        }
      } else {
        lastTickAtRef.current = null;
        setLastTickAt(null);
      }

      return next;
    });
  };

  const flushFocusProgress = async () => {
    if (!user) return;
    if (mode !== 'focus') return;

    const totalFocusSeconds = focusMinutes * 60;
    const workedSeconds = Math.max(0, Math.min(totalFocusSeconds, totalFocusSeconds - remainingSeconds));
    const workedMinutes = Math.floor(workedSeconds / 60);

    if (workedMinutes <= 0) return;

    const end = Date.now();
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
      setError('No se pudo registrar el progreso del Pomodoro al reiniciar.');
    }
  };

  const handleReset = async () => {
    setError(null);

    try {
      await flushFocusProgress();
    } catch {
      setError('Ocurrió un error al guardar el progreso antes de reiniciar.');
    }

    const initialSeconds =
      mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;

    setRemainingSeconds(initialSeconds);
    setIsRunning(false);
    setCycleStart(null);
    lastTickAtRef.current = null;
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
    lastTickAtRef.current = null;
    setLastTickAt(null);
    setError(null);
    setShowConfig(false);
  };

  const handlePhaseEnd = async (finishedMode: Mode) => {
    if (!user) return;

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
          setError('No se pudo registrar la sesión de Pomodoro.');
        }
      } catch {
        setError('Ocurrió un error al registrar la sesión.');
      }
    }

    const nextMode: Mode = finishedMode === 'focus' ? 'break' : 'focus';
    const nextSeconds =
      nextMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;

    setMode(nextMode);
    setRemainingSeconds(nextSeconds);

    if (isRunning) {
      const now = Date.now();
      lastTickAtRef.current = now;
      setLastTickAt(now);
      if (nextMode === 'focus') setCycleStart(now);
      else setCycleStart(null);
    } else {
      setCycleStart(null);
      lastTickAtRef.current = null;
      setLastTickAt(null);
    }
  };

  const activeTask =
    selectedTaskId === 'none'
      ? null
      : tasks.find((t) => t.id === selectedTaskId) ?? null;

  // Loading states
  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Parámetros del círculo SVG
  const circleRadius = 120;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - progress);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
          Pomodoro
        </h1>
        <p className="text-[var(--text-muted)] max-w-md mx-auto">
          Mantén el enfoque con sesiones de trabajo y descanso cronometradas
        </p>
      </header>

      {/* Timer principal */}
      <section className="flex flex-col items-center gap-6">
        {/* Indicador de modo */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!isRunning) {
                setMode('focus');
                setRemainingSeconds(focusMinutes * 60);
                setCycleStart(null);
              }
            }}
            disabled={isRunning}
            aria-label="Cambiar a modo enfoque"
            aria-pressed={mode === 'focus'}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
              ${mode === 'focus'
                ? 'bg-[var(--accent)] text-[var(--foreground)]'
                : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-muted)] hover:border-[var(--primary-soft)]'
              }
              ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            Enfoque
          </button>
          <button
            onClick={() => {
              if (!isRunning) {
                setMode('break');
                setRemainingSeconds(breakMinutes * 60);
                setCycleStart(null);
              }
            }}
            disabled={isRunning}
            aria-label="Cambiar a modo descanso"
            aria-pressed={mode === 'break'}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
              ${mode === 'break'
                ? 'bg-[var(--success)] text-white'
                : 'bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-muted)] hover:border-[var(--primary-soft)]'
              }
              ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            Descanso
          </button>
        </div>

        {/* Círculo del timer */}
        <div className="relative">
          <svg
            width="280"
            height="280"
            className="transform -rotate-90"
          >
            {/* Círculo de fondo */}
            <circle
              cx="140"
              cy="140"
              r={circleRadius}
              fill="none"
              stroke="var(--card-border)"
              strokeWidth="8"
            />
            {/* Círculo de progreso */}
            <circle
              cx="140"
              cy="140"
              r={circleRadius}
              fill="none"
              stroke={mode === 'focus' ? 'var(--accent)' : 'var(--success)'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circleCircumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>

          {/* Tiempo en el centro */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold font-mono text-[var(--foreground)]">
              {formattedTime}
            </span>
            <span className={`text-sm font-medium mt-1 ${mode === 'focus' ? 'text-[var(--accent)]' : 'text-[var(--success)]'}`}>
              {mode === 'focus' ? 'Enfoque' : 'Descanso'}
            </span>
          </div>
        </div>

        {/* Botones de control */}
        <div className="flex gap-3">
          <button
            onClick={handleStartPause}
            aria-label={isRunning ? 'Pausar temporizador' : 'Iniciar temporizador'}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-sm
              ${isRunning
                ? 'bg-[var(--warn)] text-[var(--foreground)]'
                : 'bg-[var(--accent)] text-[var(--foreground)]'
              }
              hover:opacity-90
            `}
          >
            {isRunning ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pausar
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Iniciar
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            aria-label="Reiniciar temporizador"
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)] transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reiniciar
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            aria-label={showConfig ? 'Cerrar configuración' : 'Abrir configuración'}
            aria-expanded={showConfig}
            className={`
              flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200
              ${showConfig
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)]'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}
      </section>

      {/* Configuración colapsable */}
      {showConfig && (
        <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)]/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--primary-soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Configuración de tiempos</h2>
              <p className="text-xs text-[var(--text-muted)]">Personaliza la duración de tus sesiones</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Minutos de enfoque
              </label>
              <input
                type="number"
                min={1}
                className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                value={focusInput}
                onChange={(e) => setFocusInput(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-muted)] mb-2">
                Minutos de descanso
              </label>
              <input
                type="number"
                min={1}
                className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200"
                value={breakInput}
                onChange={(e) => setBreakInput(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleApplyDurations}
            className="w-full px-4 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity"
          >
            Aplicar tiempos
          </button>
        </section>
      )}

      {/* Tarea vinculada */}
      <PremiumGate feature="pomodoro_link">
        <section className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-[var(--foreground)]">Vincular con tarea</h2>
              <p className="text-xs text-[var(--text-muted)]">Las sesiones se registrarán asociadas a esta tarea</p>
            </div>
          </div>

          {tasksLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[var(--card-border)] rounded-xl bg-[var(--background)]/50">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-[var(--text-muted)] mb-1">No hay tareas pendientes</p>
              <p className="text-xs text-[var(--text-muted)]">Crea una tarea desde la sección Tareas</p>
            </div>
          ) : (
            <>
              <select
                className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--background)] text-[var(--foreground)] transition-all duration-200 mb-4"
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

              {activeTask && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--background)] border border-[var(--card-border)]">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate">
                      {activeTask.title}
                    </p>
                    {activeTask.due_date && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Fecha límite: {new Date(activeTask.due_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </PremiumGate>

    </main>
  );
}
