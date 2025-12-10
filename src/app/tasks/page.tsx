// src/app/tasks/page.tsx
'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Priority = 'low' | 'medium' | 'high';

type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null; // YYYY-MM-DD
  completed: boolean;
  created_at: string;
  course_id: string | null;
  priority: Priority | null;
  tags: string | null;
};

type TaskWithStats = Task & {
  focusMinutes: number; // minutos acumulados de Pomodoro para esta tarea
};

type Course = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
};

type Filter = 'all' | 'pending' | 'completed';
type PriorityFilter = 'all' | Priority;

export default function TasksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Campos nueva tarea
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newTaskCourseId, setNewTaskCourseId] = useState<string>('none');
  const [newTaskPriority, setNewTaskPriority] =
    useState<Priority>('medium');
  const [newTaskTags, setNewTaskTags] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [filterPriority, setFilterPriority] =
    useState<PriorityFilter>('all');

  // estados para confirmaciones
  const [taskToDelete, setTaskToDelete] = useState<TaskWithStats | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const [showClearCompleted, setShowClearCompleted] = useState(false);
  const [clearing, setClearing] = useState(false);

  // estados para edición
  const [taskBeingEdited, setTaskBeingEdited] = useState<TaskWithStats | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editCourseId, setEditCourseId] = useState<string>('none');
  const [editPriority, setEditPriority] =
    useState<Priority>('medium');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar materias
  useEffect(() => {
    if (!user) return;

    const fetchCourses = async () => {
      setLoadingCourses(true);
      const { data, error } = await supabaseClient
        .from('courses')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        console.error(error);
        setError('No se pudieron cargar las materias.');
      } else {
        setCourses((data ?? []) as Course[]);
      }
      setLoadingCourses(false);
    };

    fetchCourses();
  }, [user]);

  // Cargar tareas + minutos de Pomodoro por tarea
  useEffect(() => {
    if (!user) return;

    const fetchTasksAndStats = async () => {
      setLoadingTasks(true);
      setError(null);

      const { data: tasksData, error: tasksError } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
        console.error(tasksError);
        setError('Error al cargar tareas');
        setLoadingTasks(false);
        return;
      }

      const baseTasks = (tasksData ?? []) as Task[];

      const { data: sessionsData, error: sessionsError } = await supabaseClient
        .from('pomodoro_sessions')
        .select('task_id, duration_minutes')
        .eq('user_id', user.id)
        .not('task_id', 'is', null);

      if (sessionsError) {
        console.error(sessionsError);
      }

      const minutesByTask = new Map<string, number>();
      (sessionsData ?? []).forEach((s: any) => {
        const id = s.task_id as string | null;
        if (!id) return;
        const current = minutesByTask.get(id) ?? 0;
        minutesByTask.set(id, current + (s.duration_minutes ?? 0));
      });

      const withStats: TaskWithStats[] = baseTasks.map((t) => ({
        ...t,
        focusMinutes: minutesByTask.get(t.id) ?? 0,
      }));

      setTasks(withStats);
      setLoadingTasks(false);
    };

    fetchTasksAndStats();
  }, [user]);

  // Crear nueva tarea
  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    const courseIdToSave =
      newTaskCourseId && newTaskCourseId !== 'none'
        ? newTaskCourseId
        : null;

    const tagsToSave =
      newTaskTags.trim().length > 0 ? newTaskTags.trim() : null;

    const { data, error } = await supabaseClient
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        due_date: dueDate || null,
        course_id: courseIdToSave,
        priority: newTaskPriority,
        tags: tagsToSave,
      })
      .select('*')
      .single();

    if (error) {
      console.error(error);
      setError('No se pudo crear la tarea');
      return;
    }

    const task = data as Task;
    setTasks((prev) => [{ ...task, focusMinutes: 0 }, ...prev]);
    setTitle('');
    setDescription('');
    setDueDate('');
    setNewTaskCourseId('none');
    setNewTaskPriority('medium');
    setNewTaskTags('');
  };

  const toggleCompleted = async (task: TaskWithStats) => {
    const { data, error } = await supabaseClient
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id)
      .eq('user_id', user?.id as string)
      .select('*')
      .single();

    if (error) {
      console.error(error);
      setError('No se pudo actualizar la tarea');
      return;
    }

    const updated = data as Task;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...updated, focusMinutes: task.focusMinutes }
          : t,
      ),
    );
  };

  // Helpers materias
  const courseMap = useMemo(
    () =>
      new Map(
        courses.map((c) => [
          c.id,
          { name: c.name, color: c.color },
        ]),
      ),
    [courses],
  );

  const getCourseLabel = (courseId: string | null) => {
    if (!courseId) return null;
    const c = courseMap.get(courseId);
    if (!c) return null;
    return c;
  };

  // ---- Edición de tarea ----
  const openEditTask = (task: TaskWithStats) => {
    setTaskBeingEdited(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditDueDate(task.due_date ?? '');
    setEditCourseId(task.course_id ?? 'none');
    setEditPriority(task.priority ?? 'medium');
    setEditTags(task.tags ?? '');
    setError(null);
  };

  const cancelEditTask = () => {
    setTaskBeingEdited(null);
  };

  const confirmEditTask = async () => {
    if (!taskBeingEdited || !user) return;
    if (!editTitle.trim()) {
      setError('El título de la tarea es obligatorio.');
      return;
    }

    const courseIdToSave =
      editCourseId && editCourseId !== 'none'
        ? editCourseId
        : null;

    const tagsToSave =
      editTags.trim().length > 0 ? editTags.trim() : null;

    setSavingEdit(true);
    const { data, error } = await supabaseClient
      .from('tasks')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        due_date: editDueDate || null,
        course_id: courseIdToSave,
        priority: editPriority,
        tags: tagsToSave,
      })
      .eq('id', taskBeingEdited.id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    setSavingEdit(false);

    if (error) {
      console.error(error);
      setError('No se pudieron guardar los cambios de la tarea');
      return;
    }

    const updated = data as Task;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskBeingEdited.id
          ? { ...updated, focusMinutes: t.focusMinutes }
          : t,
      ),
    );
    setTaskBeingEdited(null);
  };

  // ---- Eliminar tarea ----
  const askDeleteTask = (task: TaskWithStats) => {
    setTaskToDelete(task);
    setError(null);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete || !user) return;

    setDeleting(true);
    const { error } = await supabaseClient
      .from('tasks')
      .delete()
      .eq('id', taskToDelete.id)
      .eq('user_id', user.id);

    setDeleting(false);

    if (error) {
      console.error(error);
      setError('No se pudo eliminar la tarea');
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
    setTaskToDelete(null);
  };

  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  // ---- Limpiar completadas ----
  const hasCompleted = useMemo(
    () => tasks.some((t) => t.completed),
    [tasks],
  );

  const askClearCompleted = () => {
    if (!hasCompleted) return;
    setShowClearCompleted(true);
  };

  const confirmClearCompleted = async () => {
    if (!hasCompleted || !user) {
      setShowClearCompleted(false);
      return;
    }

    setClearing(true);

    const { error } = await supabaseClient
      .from('tasks')
      .delete()
      .eq('completed', true)
      .eq('user_id', user.id);

    setClearing(false);

    if (error) {
      console.error(error);
      setError('No se pudieron limpiar las tareas completadas');
      return;
    }

    setTasks((prev) => prev.filter((t) => !t.completed));
    setShowClearCompleted(false);
  };

  const cancelClearCompleted = () => {
    setShowClearCompleted(false);
  };

  // Helpers de estado (hoy / vencida / próxima)
  const todayStr = new Date().toISOString().slice(0, 10);

  const getStatusLabel = (
    task: TaskWithStats,
  ): { label: string; tone: 'danger' | 'warn' | 'ok' | 'none' } => {
    if (!task.due_date) return { label: 'Sin fecha', tone: 'none' };

    if (task.completed) {
      return { label: 'Completada', tone: 'ok' };
    }

    if (task.due_date < todayStr) {
      return { label: 'Vencida', tone: 'danger' };
    }

    if (task.due_date === todayStr) {
      return { label: 'Hoy', tone: 'warn' };
    }

    return { label: 'Próxima', tone: 'ok' };
  };

  const getPriorityLabel = (p: Priority | null): string => {
    const value = p ?? 'medium';
    if (value === 'high') return 'Alta';
    if (value === 'low') return 'Baja';
    return 'Media';
  };

  const getPriorityClass = (p: Priority | null): string => {
    const value = p ?? 'medium';
    if (value === 'high') {
      return 'bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/40';
    }
    if (value === 'low') {
      return 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/40';
    }
    return 'bg-[var(--warn)]/15 text-[var(--warn)] border border-[var(--warn)]/40';
  };

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  };

  // Aplicar filtro
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'pending' && t.completed) return false;
      if (filter === 'completed' && !t.completed) return false;

      if (filterCourseId !== 'all') {
        if (!t.course_id || t.course_id !== filterCourseId) return false;
      }

      if (filterPriority !== 'all') {
        const p = (t.priority ?? 'medium') as Priority;
        if (p !== filterPriority) return false;
      }

      return true;
    });
  }, [tasks, filter, filterCourseId, filterPriority]);

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold mb-1">Mis tareas</h1>
          <p className="text-sm text-gray-400">
            Organice trabajos, exámenes y pendientes de estudio.
          </p>
        </header>

        {/* Formulario nueva tarea */}
        <section className="border border-[var(--card-border)] rounded-xl p-4 flex flex-col gap-3 bg-[var(--card-bg)]">
          <h2 className="font-semibold text-sm mb-1">Nueva tarea</h2>

          <form
            onSubmit={handleAddTask}
            className="flex flex-col gap-3"
          >
            <input
              type="text"
              placeholder="Título de la tarea (obligatorio)"
              className="border border-[var(--card-border)] rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <textarea
              placeholder="Descripción (opcional)"
              className="border border-[var(--card-border)] rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span>Fecha límite:</span>
                <input
                  type="date"
                  className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>

              <label className="flex items-center gap-2">
                <span>Materia:</span>
                <select
                  className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={newTaskCourseId}
                  onChange={(e) => setNewTaskCourseId(e.target.value)}
                  disabled={loadingCourses}
                >
                  <option value="none">Sin materia</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <span>Prioridad:</span>
                <select
                  className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={newTaskPriority}
                  onChange={(e) =>
                    setNewTaskPriority(e.target.value as Priority)
                  }
                >
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-1 text-sm">
              <label className="flex flex-col gap-1">
                <span>Etiquetas (separadas por coma)</span>
                <input
                  type="text"
                  className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={newTaskTags}
                  onChange={(e) => setNewTaskTags(e.target.value)}
                  placeholder="Ejemplo: parcial, tp, final"
                />
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              className="self-start px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--foreground)] text-sm font-semibold"
            >
              Agregar
            </button>
          </form>
        </section>

        {/* Filtros y resumen */}
        <section className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="inline-flex border border-[var(--card-border)] rounded-full overflow-hidden bg-[var(--card-bg)]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 ${
                filter === 'all'
                  ? 'bg-[var(--accent)] text-[var(--foreground)] font-semibold'
                  : 'opacity-80'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 border-l border-[var(--card-border)] ${
                filter === 'pending'
                  ? 'bg-[var(--accent)] text-[var(--foreground)] font-semibold'
                  : 'opacity-80'
              }`}
            >
              Pendientes
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 border-l border-[var(--card-border)] ${
                filter === 'completed'
                  ? 'bg-[var(--accent)] text-[var(--foreground)] font-semibold'
                  : 'opacity-80'
              }`}
            >
              Completadas
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span>Materia:</span>
              <select
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-[var(--card-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={filterCourseId}
                onChange={(e) => setFilterCourseId(e.target.value)}
                disabled={loadingCourses}
              >
                <option value="all">Todas</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span>Prioridad:</span>
              <select
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-[var(--card-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={filterPriority}
                onChange={(e) =>
                  setFilterPriority(
                    e.target.value as PriorityFilter,
                  )
                }
              >
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </label>

            <p className="text-gray-400">
              {tasks.filter((t) => !t.completed).length} pendientes ·{' '}
              {tasks.filter((t) => t.completed).length} completadas
            </p>

            <button
              type="button"
              onClick={askClearCompleted}
              disabled={!hasCompleted}
              className="text-xs px-3 py-1 rounded-full border border-[var(--card-border)] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Limpiar completadas
            </button>
          </div>
        </section>

        {/* Listado */}
        <section className="border border-[var(--card-border)] rounded-xl p-4 bg-[var(--card-bg)]">
          <h2 className="font-semibold text-sm mb-3">Listado</h2>

          {loadingTasks && <p>Cargando tareas...</p>}

          {!loadingTasks && filteredTasks.length === 0 && (
            <p className="text-sm text-gray-400">
              No hay tareas para el filtro seleccionado.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {filteredTasks.map((task) => {
              const status = getStatusLabel(task);

              const statusClass =
                status.tone === 'danger'
                  ? 'bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/40'
                  : status.tone === 'warn'
                  ? 'bg-[var(--warn)]/15 text-[var(--warn)] border border-[var(--warn)]/40'
                  : status.tone === 'ok'
                  ? 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/40'
                  : 'bg-gray-400/10 text-gray-300 border border-gray-500/30';

              const course = getCourseLabel(task.course_id);
              const priorityLabel = getPriorityLabel(task.priority);
              const priorityClass = getPriorityClass(task.priority);
              const tagsList = parseTags(task.tags);

              return (
                <li
                  key={task.id}
                  className="flex justify-between items-start gap-3 border border-[var(--card-border)] rounded-lg px-3 py-2 bg-[var(--card-bg)]"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleCompleted(task)}
                      className="mt-1"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p
                          className={`font-medium text-sm ${
                            task.completed ? 'line-through opacity-60' : ''
                          }`}
                        >
                          {task.title}
                        </p>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${statusClass}`}
                        >
                          {status.label}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${priorityClass}`}
                        >
                          Prioridad: {priorityLabel}
                        </span>

                        {course && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] border border-[var(--card-border)]"
                            style={{
                              backgroundColor: course.color
                                ? `${course.color}33`
                                : undefined,
                            }}
                          >
                            {course.name}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-200 mb-1">
                          {task.description}
                        </p>
                      )}

                      {tagsList.length > 0 && (
                        <p className="text-[11px] text-gray-300 mb-1">
                          Etiquetas:{' '}
                          {tagsList.map((tag, idx) => (
                            <span
                              key={`${task.id}-tag-${idx}`}
                              className="inline-block px-2 py-0.5 mr-1 mb-1 rounded-full border border-[var(--card-border)] text-[10px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </p>
                      )}

                      {task.due_date && (
                        <p className="text-[11px] text-gray-400">
                          Fecha límite: {task.due_date}
                        </p>
                      )}

                      {task.focusMinutes > 0 && (
                        <p className="text-[11px] text-[var(--success)] mt-1">
                          Tiempo Pomodoro dedicado: {task.focusMinutes} min
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => openEditTask(task)}
                      className="text-[11px] text-[var(--accent)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => askDeleteTask(task)}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {/* Confirmación eliminar tarea */}
      <ConfirmDialog
        open={!!taskToDelete}
        title="Confirmar eliminación"
        description={
          <>
            ¿Seguro que desea eliminar la tarea{' '}
            <span className="font-medium">
              “{taskToDelete?.title}”
            </span>
            ?
          </>
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={cancelDeleteTask}
        onConfirm={confirmDeleteTask}
      />

      {/* Confirmación limpiar completadas */}
      <ConfirmDialog
        open={showClearCompleted}
        title="Limpiar tareas completadas"
        description={
          <>
            Se eliminarán todas las tareas marcadas como{' '}
            <span className="font-medium">completadas</span>. Esta
            acción no se puede deshacer.
          </>
        }
        confirmLabel="Limpiar"
        cancelLabel="Cancelar"
        loading={clearing}
        onCancel={cancelClearCompleted}
        onConfirm={confirmClearCompleted}
      />

      {/* Modal de edición de tarea */}
      <ConfirmDialog
        open={!!taskBeingEdited}
        title="Editar tarea"
        description={
          <div className="flex flex-col gap-3 mt-1">
            <label className="flex flex-col gap-1 text-sm">
              <span>Título</span>
              <input
                type="text"
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Descripción</span>
              <textarea
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Fecha límite</span>
              <input
                type="date"
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Materia</span>
              <select
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={editCourseId}
                onChange={(e) => setEditCourseId(e.target.value)}
                disabled={loadingCourses}
              >
                <option value="none">Sin materia</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Prioridad</span>
              <select
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={editPriority}
                onChange={(e) =>
                  setEditPriority(e.target.value as Priority)
                }
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Etiquetas (separadas por coma)</span>
              <input
                type="text"
                className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="Ejemplo: parcial, tp, final"
              />
            </label>
          </div>
        }
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        loading={savingEdit}
        onCancel={cancelEditTask}
        onConfirm={confirmEditTask}
      />
    </>
  );
}
