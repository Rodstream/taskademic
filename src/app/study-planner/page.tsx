// src/app/study-planner/page.tsx
'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { FaGraduationCap, FaPlus, FaTimes, FaCalendarAlt, FaClock } from 'react-icons/fa';

type ExamPlan = {
  id: string;
  course_id: string | null;
  name: string;
  exam_date: string; // YYYY-MM-DD
  study_hours: number;
  created_at: string;
};

type Course = { id: string; name: string; color: string | null };
type TaskRow = { id: string; course_id: string | null };
type Session = { id: string; task_id: string | null; duration_minutes: number };

const URGENCY_STYLES = {
  green:  { badge: 'text-[var(--success)] bg-[var(--success)]/10',  border: 'border-[var(--card-border)]' },
  yellow: { badge: 'text-[var(--warn)] bg-[var(--warn)]/10',        border: 'border-[var(--warn)]/30' },
  red:    { badge: 'text-[var(--danger)] bg-[var(--danger)]/10',    border: 'border-[var(--danger)]/30' },
  past:   { badge: 'text-[var(--text-muted)] bg-[var(--card-border)]/40', border: 'border-[var(--card-border)]' },
};

export default function StudyPlannerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [plans, setPlans]       = useState<ExamPlan[]>([]);
  const [courses, setCourses]   = useState<Course[]>([]);
  const [tasks, setTasks]       = useState<TaskRow[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError]            = useState<string | null>(null);
  const [deleting, setDeleting]      = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formCourseId, setFormCourseId] = useState<string>('');
  const [formName, setFormName]         = useState('');
  const [formDate, setFormDate]         = useState('');
  const [formHours, setFormHours]       = useState('10');

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  // Fetch all data in parallel
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setPageLoading(true);
      setError(null);

      const [plansRes, coursesRes, tasksRes, sessionsRes] = await Promise.all([
        supabaseClient.from('exam_plans').select('*').eq('user_id', user.id).order('exam_date'),
        supabaseClient.from('courses').select('id, name, color').eq('user_id', user.id),
        supabaseClient.from('tasks').select('id, course_id').eq('user_id', user.id),
        supabaseClient.from('pomodoro_sessions').select('id, task_id, duration_minutes').eq('user_id', user.id),
      ]);

      if (plansRes.error) {
        setError('No se pudieron cargar los planes. Verificá que la tabla exam_plans exista en Supabase.');
      } else {
        setPlans((plansRes.data ?? []) as ExamPlan[]);
      }
      setCourses((coursesRes.data ?? []) as Course[]);
      setTasks((tasksRes.data ?? []) as TaskRow[]);
      setSessions((sessionsRes.data ?? []) as Session[]);
      setPageLoading(false);
    };

    fetchData();
  }, [user]);

  // task_id → course_id
  const taskCourseMap = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => { if (t.course_id) m.set(t.id, t.course_id); });
    return m;
  }, [tasks]);

  // course_id → Course
  const coursesMap = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // Enrich each plan with computed values
  const enrichedPlans = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const msPerDay = 86_400_000;

    return [...plans]
      .sort((a, b) => {
        // upcoming first, past last
        const aFuture = a.exam_date >= today;
        const bFuture = b.exam_date >= today;
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return a.exam_date.localeCompare(b.exam_date);
      })
      .map((plan) => {
        const actualMinutes = sessions
          .filter((s) => s.task_id && taskCourseMap.get(s.task_id) === plan.course_id)
          .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

        const totalMinutes = plan.study_hours * 60;
        const isPast = plan.exam_date < today;

        const daysRemaining = Math.max(
          1,
          Math.ceil((new Date(plan.exam_date).getTime() - new Date(today).getTime()) / msPerDay),
        );

        const remainingMinutes = Math.max(0, totalMinutes - actualMinutes);
        const suggestedMinPerDay = isPast ? 0 : Math.ceil(remainingMinutes / daysRemaining);
        const progressPct = totalMinutes > 0
          ? Math.min(100, Math.round((actualMinutes / totalMinutes) * 100))
          : 0;

        const urgency: keyof typeof URGENCY_STYLES = isPast
          ? 'past'
          : daysRemaining <= 2
          ? 'red'
          : daysRemaining <= 7
          ? 'yellow'
          : 'green';

        return {
          ...plan,
          actualMinutes,
          totalMinutes,
          daysRemaining,
          suggestedMinPerDay,
          progressPct,
          urgency,
          isPast,
        };
      });
  }, [plans, sessions, taskCourseMap]);

  function openForm() {
    setFormCourseId('');
    setFormName('');
    setFormDate('');
    setFormHours('10');
    setShowForm(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmedName = formName.trim();
    if (!trimmedName) return;
    if (!formDate) return;

    const hours = parseFloat(formHours);
    if (isNaN(hours) || hours <= 0) return;

    setSaving(true);
    const { data, error: insertError } = await supabaseClient
      .from('exam_plans')
      .insert({
        user_id: user.id,
        course_id: formCourseId || null,
        name: trimmedName,
        exam_date: formDate,
        study_hours: hours,
      })
      .select()
      .single();

    if (!insertError && data) {
      setPlans((prev) => [...prev, data as ExamPlan]);
    }
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabaseClient.from('exam_plans').delete().eq('id', id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setDeleting(null);
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--foreground)]">
            <FaGraduationCap className="text-[var(--accent)]" />
            Planificador de examen
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Seguí cuánto tenés que estudiar por día para llegar a tu meta
          </p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 transition-opacity shrink-0 shadow-sm"
        >
          <FaPlus size={11} />
          Agregar examen
        </button>
      </header>

      {/* Error */}
      {error && (
        <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-3 rounded-2xl border border-[var(--danger)]/20">
          {error}
        </p>
      )}

      {/* Loading */}
      {pageLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : enrichedPlans.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-5 py-20 rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)]">
          <div className="w-16 h-16 rounded-3xl bg-[var(--accent)]/10 flex items-center justify-center">
            <FaGraduationCap className="text-3xl text-[var(--accent)]" />
          </div>
          <div className="text-center max-w-xs">
            <p className="font-semibold text-[var(--foreground)] mb-1">Sin exámenes registrados</p>
            <p className="text-sm text-[var(--text-muted)]">
              Cargá tu próximo examen y la app te dice cuánto estudiar por día
            </p>
          </div>
          <button
            onClick={openForm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <FaPlus size={11} />
            Agregar examen
          </button>
        </div>
      ) : (
        /* Plan cards */
        <div className="flex flex-col gap-4">
          {enrichedPlans.map((plan) => {
            const course = plan.course_id ? coursesMap.get(plan.course_id) : null;
            const styles = URGENCY_STYLES[plan.urgency];

            return (
              <article
                key={plan.id}
                className={`rounded-3xl border ${styles.border} bg-[var(--card-bg)] p-6 flex flex-col gap-4 ${plan.isPast ? 'opacity-60' : ''}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {course ? (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: course.color || 'var(--accent)' }}
                      />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-[var(--text-muted)]/30 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--foreground)] truncate">
                        {plan.name}
                      </p>
                      {course && (
                        <p className="text-xs text-[var(--text-muted)] truncate">{course.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Days badge */}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl ${styles.badge}`}>
                      {plan.isPast
                        ? 'Realizado'
                        : plan.daysRemaining === 1
                        ? '¡Hoy!'
                        : `en ${plan.daysRemaining} días`}
                    </span>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(plan.id)}
                      disabled={deleting === plan.id}
                      className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-40"
                      aria-label="Eliminar"
                    >
                      <FaTimes size={11} />
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <FaCalendarAlt size={10} />
                  <span>
                    {new Date(plan.exam_date + 'T00:00:00').toLocaleDateString('es-AR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      {Math.round(plan.actualMinutes / 60 * 10) / 10} h enfocadas
                    </span>
                    <span className="font-medium text-[var(--foreground)]">
                      {plan.progressPct}% de {plan.study_hours} h objetivo
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[var(--card-border)]/50 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${plan.progressPct}%`,
                        backgroundColor:
                          plan.progressPct >= 100
                            ? 'var(--success)'
                            : plan.urgency === 'red'
                            ? 'var(--danger)'
                            : plan.urgency === 'yellow'
                            ? 'var(--warn)'
                            : 'var(--accent)',
                      }}
                    />
                  </div>
                </div>

                {/* Daily suggestion */}
                {!plan.isPast && plan.progressPct < 100 && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] bg-[var(--background)] rounded-2xl px-4 py-3 border border-[var(--card-border)]">
                    <FaClock size={12} className="shrink-0" />
                    <span>
                      Sugerido:{' '}
                      <strong className="text-[var(--foreground)]">
                        {plan.suggestedMinPerDay} min/día
                      </strong>{' '}
                      para llegar a tu meta
                    </span>
                  </div>
                )}

                {plan.progressPct >= 100 && !plan.isPast && (
                  <div className="flex items-center gap-2 text-sm text-[var(--success)] bg-[var(--success)]/8 rounded-2xl px-4 py-3 border border-[var(--success)]/20">
                    ✓ Meta alcanzada — ya superaste las {plan.study_hours} h planeadas
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="w-full max-w-md rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">Nuevo examen</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[var(--card-border)]/40 text-[var(--text-muted)] transition-colors"
              >
                <FaTimes size={12} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              {/* Materia */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-muted)]">Materia (opcional)</span>
                <select
                  value={formCourseId}
                  onChange={(e) => setFormCourseId(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                >
                  <option value="">Sin materia</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              {/* Nombre */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-muted)]">Nombre del examen</span>
                <input
                  type="text"
                  required
                  placeholder="Ej: Primer parcial"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>

              {/* Fecha */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-muted)]">Fecha del examen</span>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              </label>

              {/* Horas objetivo */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--text-muted)]">Horas de estudio objetivo</span>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  step={0.5}
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
                <span className="text-[11px] text-[var(--text-muted)]">
                  ¿Cuántas horas en total querés invertir para preparar este examen?
                </span>
              </label>

              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--card-border)] text-sm font-medium hover:bg-[var(--card-border)]/30 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
