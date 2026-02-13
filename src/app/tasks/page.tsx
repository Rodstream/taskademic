// src/app/tasks/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';
import { validateTaskTitle, validateTaskDescription, validateDateFormat, sanitizeInput } from '@/lib/validation';
import { useAuth } from '@/context/AuthContext';
import { usePlan } from '@/context/PlanContext';
import { getLimitMessage } from '@/lib/plans';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PremiumGate } from '@/components/PremiumGate';
import LoadingSpinner from '@/components/LoadingSpinner';

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
type DateOrder = 'nearest' | 'farthest';

type Subtask = {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  created_at: string;
};

function TasksPageContent() {
  const { user, loading } = useAuth();
  const { isWithinLimit, canAccess } = usePlan();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<TaskWithStats[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Campos nueva tarea
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newTaskCourseId, setNewTaskCourseId] = useState<string>('none');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium');
  const [newTaskTags, setNewTaskTags] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filter, setFilter] = useState<Filter>('all');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all');
  const [dateOrder, setDateOrder] = useState<DateOrder>('nearest');
  const [showFilters, setShowFilters] = useState(false);

  // Modal nueva tarea
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  // estados para confirmaciones
  const [taskToDelete, setTaskToDelete] = useState<TaskWithStats | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [clearConfirmStep, setClearConfirmStep] = useState<0 | 1 | 2>(0); // 0 = cerrado, 1 = primer paso, 2 = segundo paso
  const [clearing, setClearing] = useState(false);

  // estados para edición
  const [taskBeingEdited, setTaskBeingEdited] = useState<TaskWithStats | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editCourseId, setEditCourseId] = useState<string>('none');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // ---- Subtasks state (checklist) ----
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(
    () => new Set(),
  );
  const [subtasksByTaskId, setSubtasksByTaskId] = useState<
    Record<string, Subtask[]>
  >({});
  const [subtasksLoadingByTaskId, setSubtasksLoadingByTaskId] = useState<
    Record<string, boolean>
  >({});
  const [newSubtaskTitleByTaskId, setNewSubtaskTitleByTaskId] = useState<
    Record<string, string>
  >({});
  const [subtaskCountsByTaskId, setSubtaskCountsByTaskId] = useState<
    Record<string, { total: number; done: number }>
  >({});

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Abrir modal si viene con ?new=true
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setShowNewTaskModal(true);
      // Limpiar el parámetro de la URL sin recargar
      router.replace('/tasks', { scroll: false });
    }
  }, [searchParams, router]);

  // Cargar materias
  useEffect(() => {
    if (!user) return;

    const fetchCourses = async () => {
      setLoadingCourses(true);
      const { data, error } = await supabaseClient
        .from('courses')
        .select('id, user_id, name, color')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) {
        setError('No se pudieron cargar las materias.');
      } else {
        setCourses((data ?? []) as Course[]);
      }
      setLoadingCourses(false);
    };

    fetchCourses();
  }, [user]);

  // Cargar tareas + minutos de Pomodoro por tarea (+ counts de subtareas)
  useEffect(() => {
    if (!user) return;

    const fetchTasksAndStats = async () => {
      setLoadingTasks(true);
      setError(null);

      const { data: tasksData, error: tasksError } = await supabaseClient
        .from('tasks')
        .select('id, user_id, title, description, due_date, completed, created_at, course_id, priority, tags')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (tasksError) {
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

      // counts de subtareas (si la tabla existe y hay permisos)
      try {
        const taskIds = baseTasks.map((t) => t.id);
        if (taskIds.length > 0) {
          const { data: stData, error: stError } = await supabaseClient
            .from('task_subtasks')
            .select('task_id, completed')
            .in('task_id', taskIds);

          if (!stError) {
            const counts: Record<string, { total: number; done: number }> = {};
            (stData ?? []).forEach((row: any) => {
              const tid = row.task_id as string;
              const completed = !!row.completed;
              if (!counts[tid]) counts[tid] = { total: 0, done: 0 };
              counts[tid].total += 1;
              if (completed) counts[tid].done += 1;
            });
            setSubtaskCountsByTaskId(counts);
          }
        }
      } catch {
        // silently ignore subtask count errors
      }

      setLoadingTasks(false);
    };

    fetchTasksAndStats();
  }, [user]);

  // Crear nueva tarea
  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    // Validar título
    const titleValidation = validateTaskTitle(title);
    if (!titleValidation.valid) {
      setError(titleValidation.error ?? 'Título inválido');
      return;
    }

    // Validar descripción
    const descValidation = validateTaskDescription(description);
    if (!descValidation.valid) {
      setError(descValidation.error ?? 'Descripción inválida');
      return;
    }

    // Validar fecha
    const dateValidation = validateDateFormat(dueDate);
    if (!dateValidation.valid) {
      setError(dateValidation.error ?? 'Fecha inválida');
      return;
    }

    // Verificar límite de tareas activas
    const activeTasks = tasks.filter((t) => !t.completed).length;
    if (!isWithinLimit('active_tasks', activeTasks)) {
      setError(getLimitMessage('active_tasks'));
      return;
    }

    const courseIdToSave =
      newTaskCourseId && newTaskCourseId !== 'none' ? newTaskCourseId : null;

    // Sanitizar tags
    const tagsToSave = newTaskTags.trim().length > 0 ? sanitizeInput(newTaskTags.trim()) : null;

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
      .select('id, user_id, title, description, due_date, completed, created_at, course_id, priority, tags')
      .single();

    if (error) {
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
    setShowNewTaskModal(false);
  };

  const toggleCompleted = useCallback(async (task: TaskWithStats) => {
    // Optimistic update: actualizar UI inmediatamente
    const newCompleted = !task.completed;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: newCompleted } : t,
      ),
    );

    const { data, error } = await supabaseClient
      .from('tasks')
      .update({ completed: newCompleted })
      .eq('id', task.id)
      .eq('user_id', user?.id as string)
      .select('id, user_id, title, description, due_date, completed, created_at, course_id, priority, tags')
      .single();

    if (error) {
      // Revertir en caso de error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: task.completed } : t,
        ),
      );
      setError('No se pudo actualizar la tarea');
      return;
    }

    const updated = data as Task;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...updated, focusMinutes: task.focusMinutes } : t,
      ),
    );
  }, [user?.id]);

  // Helpers materias
  const courseMap = useMemo(
    () =>
      new Map(
        courses.map((c) => [c.id, { name: c.name, color: c.color }]),
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
      editCourseId && editCourseId !== 'none' ? editCourseId : null;

    const tagsToSave = editTags.trim().length > 0 ? editTags.trim() : null;

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
      .select('id, user_id, title, description, due_date, completed, created_at, course_id, priority, tags')
      .single();

    setSavingEdit(false);

    if (error) {
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
      setError('No se pudo eliminar la tarea');
      return;
    }

    // limpiar caches de subtareas
    setSubtasksByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskToDelete.id];
      return next;
    });
    setSubtaskCountsByTaskId((prev) => {
      const next = { ...prev };
      delete next[taskToDelete.id];
      return next;
    });
    setExpandedSubtasks((prev) => {
      const next = new Set(prev);
      next.delete(taskToDelete.id);
      return next;
    });

    setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
    setTaskToDelete(null);
  };

  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  // ---- Limpiar completadas (doble confirmación) ----
  const hasCompleted = useMemo(() => tasks.some((t) => t.completed), [tasks]);
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  const askClearCompleted = () => {
    if (!hasCompleted) return;
    setClearConfirmStep(1);
  };

  const confirmClearCompleted = async () => {
    // Si estamos en el paso 1, pasar al paso 2
    if (clearConfirmStep === 1) {
      setClearConfirmStep(2);
      return;
    }

    // Si estamos en el paso 2, ejecutar la eliminación
    if (!hasCompleted || !user) {
      setClearConfirmStep(0);
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
      setError('No se pudieron limpiar las tareas completadas');
      return;
    }

    const remaining = tasks.filter((t) => !t.completed).map((t) => t.id);
    setSubtasksByTaskId((prev) => {
      const next: Record<string, Subtask[]> = {};
      for (const id of remaining) {
        if (prev[id]) next[id] = prev[id];
      }
      return next;
    });
    setSubtaskCountsByTaskId((prev) => {
      const next: Record<string, { total: number; done: number }> = {};
      for (const id of remaining) {
        if (prev[id]) next[id] = prev[id];
      }
      return next;
    });
    setExpandedSubtasks((prev) => {
      const next = new Set<string>();
      for (const id of remaining) {
        if (prev.has(id)) next.add(id);
      }
      return next;
    });

    setTasks((prev) => prev.filter((t) => !t.completed));
    setClearConfirmStep(0);
  };

  const cancelClearCompleted = () => {
    setClearConfirmStep(0);
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

  // ---- Subtasks helpers ----
  const ensureSubtasksLoaded = useCallback(async (taskId: string) => {
    if (!user) return;
    if (subtasksByTaskId[taskId]) return;
    if (subtasksLoadingByTaskId[taskId]) return;

    setSubtasksLoadingByTaskId((prev) => ({ ...prev, [taskId]: true }));
    setError(null);

    const { data, error } = await supabaseClient
      .from('task_subtasks')
      .select('id, task_id, title, completed, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    setSubtasksLoadingByTaskId((prev) => ({ ...prev, [taskId]: false }));

    if (error) {
      setError(
        'No se pudieron cargar las subtareas. Verificar tabla task_subtasks y RLS.',
      );
      return;
    }

    const list = (data ?? []) as Subtask[];
    setSubtasksByTaskId((prev) => ({ ...prev, [taskId]: list }));

    const done = list.filter((s) => s.completed).length;
    setSubtaskCountsByTaskId((prev) => ({
      ...prev,
      [taskId]: { total: list.length, done },
    }));
  }, [user, subtasksByTaskId, subtasksLoadingByTaskId]);

  const toggleSubtasksPanel = useCallback(async (taskId: string) => {
    const wasExpanded = expandedSubtasks.has(taskId);

    setExpandedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

    if (!wasExpanded) {
      await ensureSubtasksLoaded(taskId);
    }
  }, [expandedSubtasks, ensureSubtasksLoaded]);

  const addSubtask = useCallback(async (taskId: string) => {
    if (!user) return;

    const raw = (newSubtaskTitleByTaskId[taskId] ?? '').trim();
    if (!raw) return;

    setError(null);

    const { data, error } = await supabaseClient
      .from('task_subtasks')
      .insert({
        task_id: taskId,
        title: raw,
        completed: false,
      })
      .select('id, task_id, title, completed, created_at')
      .single();

    if (error) {
      setError('No se pudo crear la subtarea.');
      return;
    }

    const created = data as Subtask;

    setSubtasksByTaskId((prev) => {
      const current = prev[taskId] ?? [];
      return { ...prev, [taskId]: [...current, created] };
    });

    setSubtaskCountsByTaskId((prev) => {
      const current = prev[taskId] ?? { total: 0, done: 0 };
      return {
        ...prev,
        [taskId]: { total: current.total + 1, done: current.done },
      };
    });

    setNewSubtaskTitleByTaskId((prev) => ({ ...prev, [taskId]: '' }));
  }, [user, newSubtaskTitleByTaskId]);

  const toggleSubtaskCompleted = async (taskId: string, subtask: Subtask) => {
    if (!user) return;

    setError(null);

    const { data, error } = await supabaseClient
      .from('task_subtasks')
      .update({ completed: !subtask.completed })
      .eq('id', subtask.id)
      .select('id, task_id, title, completed, created_at')
      .single();

    if (error) {
      setError('No se pudo actualizar la subtarea.');
      return;
    }

    const updated = data as Subtask;

    setSubtasksByTaskId((prev) => {
      const current = prev[taskId] ?? [];
      return {
        ...prev,
        [taskId]: current.map((s) => (s.id === updated.id ? updated : s)),
      };
    });

    setSubtaskCountsByTaskId((prev) => {
      const current = prev[taskId] ?? { total: 0, done: 0 };
      const nextDone = subtask.completed ? current.done - 1 : current.done + 1;
      return {
        ...prev,
        [taskId]: { total: current.total, done: Math.max(0, nextDone) },
      };
    });
  };

  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    if (!user) return;

    setError(null);

    const existing = (subtasksByTaskId[taskId] ?? []).find(
      (s) => s.id === subtaskId,
    );
    const wasDone = !!existing?.completed;

    const { error } = await supabaseClient
      .from('task_subtasks')
      .delete()
      .eq('id', subtaskId);

    if (error) {
      setError('No se pudo eliminar la subtarea.');
      return;
    }

    setSubtasksByTaskId((prev) => {
      const current = prev[taskId] ?? [];
      return { ...prev, [taskId]: current.filter((s) => s.id !== subtaskId) };
    });

    setSubtaskCountsByTaskId((prev) => {
      const current = prev[taskId] ?? { total: 0, done: 0 };
      return {
        ...prev,
        [taskId]: {
          total: Math.max(0, current.total - 1),
          done: Math.max(0, current.done - (wasDone ? 1 : 0)),
        },
      };
    });
  };

  // Aplicar filtro + ORDEN por fecha
  const filteredTasks = useMemo(() => {
    const list = tasks.filter((t) => {
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

    // Orden por fecha límite (sin fecha al final)
    return list.sort((a, b) => {
      const aDate = a.due_date;
      const bDate = b.due_date;

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return dateOrder === 'nearest'
        ? aDate.localeCompare(bDate)
        : bDate.localeCompare(aDate);
    });
  }, [tasks, filter, filterCourseId, filterPriority, dateOrder]);

  // Agrupar tareas por período de tiempo
  const groupedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    const endOfWeekStr = endOfWeek.toISOString().slice(0, 10);

    const groups: {
      overdue: TaskWithStats[];
      today: TaskWithStats[];
      thisWeek: TaskWithStats[];
      upcoming: TaskWithStats[];
      noDate: TaskWithStats[];
      completed: TaskWithStats[];
    } = {
      overdue: [],
      today: [],
      thisWeek: [],
      upcoming: [],
      noDate: [],
      completed: [],
    };

    for (const task of filteredTasks) {
      // Las completadas van a su propia sección
      if (task.completed) {
        groups.completed.push(task);
      } else if (!task.due_date) {
        groups.noDate.push(task);
      } else if (task.due_date < todayStr) {
        groups.overdue.push(task);
      } else if (task.due_date === todayStr) {
        groups.today.push(task);
      } else if (task.due_date <= endOfWeekStr) {
        groups.thisWeek.push(task);
      } else {
        groups.upcoming.push(task);
      }
    }

    return groups;
  }, [filteredTasks]);

  // Props compartidas para TaskGroup
  const taskGroupProps = {
    toggleCompleted,
    openEditTask,
    askDeleteTask,
    toggleSubtasksPanel,
    getCourseLabel,
    getPriorityLabel,
    getPriorityClass,
    parseTags,
    getStatusLabel,
    expandedSubtasks,
    subtaskCountsByTaskId,
    subtasksByTaskId,
    subtasksLoadingByTaskId,
    ensureSubtasksLoaded,
    toggleSubtaskCompleted,
    deleteSubtask,
    addSubtask,
    newSubtaskTitleByTaskId,
    setNewSubtaskTitleByTaskId,
  };

  // Componente para renderizar una tarjeta de tarea
  const TaskCard = ({ task }: { task: TaskWithStats }) => {
    const status = getStatusLabel(task);
    const course = getCourseLabel(task.course_id);
    const priorityLabel = getPriorityLabel(task.priority);
    const priorityClass = getPriorityClass(task.priority);
    const tagsList = parseTags(task.tags);
    const priority = task.priority ?? 'medium';

    const isExpanded = expandedSubtasks.has(task.id);
    const counts = subtaskCountsByTaskId[task.id] ?? { total: 0, done: 0 };
    const subtasks = subtasksByTaskId[task.id] ?? [];
    const subtasksLoading = !!subtasksLoadingByTaskId[task.id];

    // Color del borde según prioridad
    const borderColor = priority === 'high'
      ? 'border-l-[var(--danger)]'
      : priority === 'low'
        ? 'border-l-[var(--success)]'
        : 'border-l-[var(--warn)]';

    return (
      <div
        className={`group relative bg-[var(--card-bg)] rounded-2xl border border-[var(--card-border)] border-l-4 ${borderColor} overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/5 hover:-translate-y-0.5 ${task.completed ? 'opacity-60' : ''}`}
      >
        <div className="p-4">
          <div className="flex gap-4">
            {/* Checkbox circular con animación */}
            <button
              type="button"
              onClick={() => toggleCompleted(task)}
              className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                task.completed
                  ? 'bg-[var(--success)] border-[var(--success)] scale-110'
                  : 'border-[var(--card-border)] hover:border-[var(--accent)] hover:scale-110'
              }`}
            >
              {task.completed && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Contenido */}
            <div className="flex-1 min-w-0">
              {/* Header con título y badges */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className={`font-semibold text-[var(--foreground)] leading-tight ${task.completed ? 'line-through opacity-70' : ''}`}>
                  {task.title}
                </h3>

                {/* Anillo de progreso de subtareas */}
                {counts.total > 0 && (
                  <div className="flex-shrink-0 relative w-8 h-8">
                    <svg className="w-8 h-8 -rotate-90">
                      <circle
                        cx="16"
                        cy="16"
                        r="12"
                        fill="none"
                        stroke="var(--card-border)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="16"
                        cy="16"
                        r="12"
                        fill="none"
                        stroke="var(--success)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(counts.done / counts.total) * 75.4} 75.4`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)]">
                      {counts.done}/{counts.total}
                    </span>
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityClass}`}>
                  {priorityLabel}
                </span>
                {course && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: course.color ? `${course.color}20` : 'var(--primary-soft)/15',
                      color: course.color || 'var(--primary-soft)',
                    }}
                  >
                    {course.name}
                  </span>
                )}
                {task.focusMinutes > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--success)]/15 text-[var(--success)]">
                    {task.focusMinutes} min
                  </span>
                )}
              </div>

              {/* Descripción */}
              {task.description && (
                <p className="text-sm text-[var(--text-muted)] mb-2 line-clamp-2">
                  {task.description}
                </p>
              )}

              {/* Tags */}
              {tagsList.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tagsList.map((tag, idx) => (
                    <span
                      key={`${task.id}-tag-${idx}`}
                      className="px-2 py-0.5 rounded-full bg-[var(--primary-soft)]/10 text-[var(--primary-soft)] text-[10px] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer con fecha */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  {task.due_date && (
                    <span className={`flex items-center gap-1 ${status.tone === 'danger' ? 'text-[var(--danger)] font-medium' : ''}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es-AR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canAccess('subtasks') && (
                    <button
                      type="button"
                      onClick={() => toggleSubtasksPanel(task.id)}
                      className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10'}`}
                      title="Subtareas"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditTask(task)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => askDeleteTask(task)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de subtareas expandible */}
        {isExpanded && (
          <div className="border-t border-[var(--card-border)] bg-[var(--background)]/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[var(--foreground)]">Subtareas</span>
              {counts.total > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  {counts.done} de {counts.total} completadas
                </span>
              )}
            </div>

            {counts.total > 0 && (
              <div className="h-1 bg-[var(--card-border)] rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--success)] to-[var(--accent)] rounded-full transition-all duration-500"
                  style={{ width: `${(counts.done / counts.total) * 100}%` }}
                />
              </div>
            )}

            {subtasksLoading && (
              <div className="flex items-center gap-2 py-3">
                <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--text-muted)]">Cargando...</span>
              </div>
            )}

            {!subtasksLoading && subtasks.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] py-2">No hay subtareas aún.</p>
            )}

            {!subtasksLoading && subtasks.length > 0 && (
              <div className="space-y-2 mb-3">
                {subtasks.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2 rounded-xl bg-[var(--card-bg)] group/sub"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubtaskCompleted(task.id, s)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        s.completed
                          ? 'bg-[var(--success)] border-[var(--success)]'
                          : 'border-[var(--card-border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {s.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${s.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--foreground)]'}`}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSubtask(task.id, s.id)}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] opacity-0 group-hover/sub:opacity-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--card-bg)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                placeholder="Nueva subtarea..."
                value={newSubtaskTitleByTaskId[task.id] ?? ''}
                onChange={(e) =>
                  setNewSubtaskTitleByTaskId((prev) => ({
                    ...prev,
                    [task.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask(task.id);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addSubtask(task.id)}
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Agregar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente para grupo de tareas
  const TaskGroup = ({
    title,
    icon,
    count,
    color,
    tasks: groupTasks
  }: {
    title: string;
    icon: React.ReactNode;
    count: number;
    color: 'danger' | 'warn' | 'accent' | 'success' | 'muted';
    tasks: TaskWithStats[];
    [key: string]: any;
  }) => {
    const colorClasses = {
      danger: 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/30',
      warn: 'bg-[var(--warn)]/10 text-[var(--warn)] border-[var(--warn)]/30',
      accent: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30',
      success: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30',
      muted: 'bg-[var(--card-bg)] text-[var(--text-muted)] border-[var(--card-border)]',
    };

    return (
      <div>
        {/* Header del grupo */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClasses[color]}`}>
            {icon}
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">{count} {count === 1 ? 'tarea' : 'tareas'}</span>
          <div className="flex-1 h-px bg-[var(--card-border)]" />
        </div>

        {/* Grid de tareas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groupTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    );
  };

  if (loading || (!user && !loading)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Mis Tareas
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Organiza trabajos, exámenes y pendientes
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewTaskModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nueva tarea
          </button>
        </header>

        {error && (
          <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Filtros y resumen */}
        <section className="flex flex-col gap-3">
          {/* Barra principal */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Tabs de estado */}
            <div className="inline-flex border border-[var(--card-border)] rounded-xl overflow-hidden bg-[var(--card-bg)]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  filter === 'all'
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  filter === 'pending'
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Pendientes
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  filter === 'completed'
                    ? 'bg-[var(--accent)] text-[var(--foreground)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                Completadas
              </button>
            </div>

            {/* Acciones derecha */}
            <div className="flex items-center gap-2">
              {/* Stats compactos */}
              <span className="text-xs text-[var(--text-muted)]">
                <span className="text-[var(--warn)]">{tasks.filter((t) => !t.completed).length}</span>
                {' / '}
                <span className="text-[var(--success)]">{tasks.filter((t) => t.completed).length}</span>
              </span>

              {/* Botón filtros */}
              {canAccess('advanced_filters') ? (
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-xl border transition-all duration-200 ${
                    showFilters
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--primary-soft)]'
                  }`}
                  title="Filtros avanzados"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  className="p-2 rounded-xl border border-[var(--card-border)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                  title="Filtros avanzados (Premium)"
                  disabled
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
              )}

              {/* Botón limpiar */}
              <button
                type="button"
                onClick={askClearCompleted}
                disabled={!hasCompleted}
                className="p-2 rounded-xl border border-[var(--card-border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Limpiar completadas"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel de filtros desplegable */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
              <select
                className="border border-[var(--card-border)] rounded-lg px-3 py-1.5 bg-[var(--background)] text-sm text-[var(--foreground)]"
                value={filterCourseId}
                onChange={(e) => setFilterCourseId(e.target.value)}
                disabled={loadingCourses}
              >
                <option value="all">Todas las materias</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                className="border border-[var(--card-border)] rounded-lg px-3 py-1.5 bg-[var(--background)] text-sm text-[var(--foreground)]"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as PriorityFilter)}
              >
                <option value="all">Todas las prioridades</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>

              <select
                className="border border-[var(--card-border)] rounded-lg px-3 py-1.5 bg-[var(--background)] text-sm text-[var(--foreground)]"
                value={dateOrder}
                onChange={(e) => setDateOrder(e.target.value as DateOrder)}
              >
                <option value="nearest">Más próxima primero</option>
                <option value="farthest">Más lejana primero</option>
              </select>

              {/* Indicador de filtros activos */}
              {(filterCourseId !== 'all' || filterPriority !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterCourseId('all');
                    setFilterPriority('all');
                  }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </section>

        {/* Listado agrupado por tiempo */}
        <section className="space-y-6">
          {loadingTasks && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loadingTasks && filteredTasks.length === 0 && (
            <div className="text-center py-16 border border-dashed border-[var(--card-border)] rounded-3xl bg-gradient-to-b from-[var(--card-bg)] to-transparent">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No hay tareas para mostrar</h3>
              <p className="text-sm text-[var(--text-muted)] mb-6">Agrega una nueva tarea o cambia los filtros</p>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-medium hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Crear primera tarea
              </button>
            </div>
          )}

          {!loadingTasks && filteredTasks.length > 0 && (
            <>
              {/* Vencidas */}
              {groupedTasks.overdue.length > 0 && (
                <TaskGroup
                  title="Vencidas"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  count={groupedTasks.overdue.length}
                  color="danger"
                  tasks={groupedTasks.overdue}
                  {...taskGroupProps}
                />
              )}

              {/* Hoy */}
              {groupedTasks.today.length > 0 && (
                <TaskGroup
                  title="Hoy"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                  count={groupedTasks.today.length}
                  color="warn"
                  tasks={groupedTasks.today}
                  {...taskGroupProps}
                />
              )}

              {/* Esta semana */}
              {groupedTasks.thisWeek.length > 0 && (
                <TaskGroup
                  title="Esta semana"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                  count={groupedTasks.thisWeek.length}
                  color="accent"
                  tasks={groupedTasks.thisWeek}
                  {...taskGroupProps}
                />
              )}

              {/* Próximamente */}
              {groupedTasks.upcoming.length > 0 && (
                <TaskGroup
                  title="Próximamente"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  count={groupedTasks.upcoming.length}
                  color="success"
                  tasks={groupedTasks.upcoming}
                  {...taskGroupProps}
                />
              )}

              {/* Sin fecha */}
              {groupedTasks.noDate.length > 0 && (
                <TaskGroup
                  title="Sin fecha"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
                  count={groupedTasks.noDate.length}
                  color="muted"
                  tasks={groupedTasks.noDate}
                  {...taskGroupProps}
                />
              )}

              {/* Completadas */}
              {groupedTasks.completed.length > 0 && (
                <TaskGroup
                  title="Completadas"
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  count={groupedTasks.completed.length}
                  color="success"
                  tasks={groupedTasks.completed}
                  {...taskGroupProps}
                />
              )}
            </>
          )}
        </section>
      </main>

      {/* Confirmación eliminar tarea */}
      <ConfirmDialog
        open={!!taskToDelete}
        title="Confirmar eliminación"
        description={
          <>
            ¿Seguro que desea eliminar la tarea{' '}
            <span className="font-medium">“{taskToDelete?.title}”</span>?
          </>
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={cancelDeleteTask}
        onConfirm={confirmDeleteTask}
      />

      {/* Confirmación limpiar completadas - Paso 1 */}
      <ConfirmDialog
        open={clearConfirmStep === 1}
        title="Limpiar tareas completadas"
        description={
          <>
            Se eliminarán <span className="font-medium text-[var(--danger)]">{completedCount} {completedCount === 1 ? 'tarea completada' : 'tareas completadas'}</span>.
            <br />
            <span className="text-[var(--text-muted)]">Esta acción no se puede deshacer.</span>
          </>
        }
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        loading={false}
        onCancel={cancelClearCompleted}
        onConfirm={confirmClearCompleted}
      />

      {/* Confirmación limpiar completadas - Paso 2 (confirmación final) */}
      <ConfirmDialog
        open={clearConfirmStep === 2}
        title="⚠️ Confirmación final"
        description={
          <>
            <span className="font-medium">¿Está completamente seguro?</span>
            <br /><br />
            Esta acción eliminará permanentemente {completedCount} {completedCount === 1 ? 'tarea' : 'tareas'} y <span className="text-[var(--danger)] font-medium">no se puede deshacer</span>.
          </>
        }
        confirmLabel="Sí, eliminar todo"
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
              {canAccess('priorities') ? (
                <select
                  className="border border-[var(--card-border)] rounded-md px-2 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as Priority)}
                >
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              ) : (
                <div className="border border-[var(--card-border)] rounded-md px-2 py-1 text-[var(--text-muted)] cursor-not-allowed">
                  Media <span className="text-[10px] text-[var(--accent)]">(Premium)</span>
                </div>
              )}
            </label>

            {canAccess('tags') ? (
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
            ) : (
              <PremiumGate feature="tags"><span /></PremiumGate>
            )}
          </div>
        }
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
        loading={savingEdit}
        onCancel={cancelEditTask}
        onConfirm={confirmEditTask}
      />

      {/* Modal Nueva Tarea */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowNewTaskModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-[var(--background)] border border-[var(--card-border)] rounded-2xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--foreground)]">Nueva tarea</h2>
                  <p className="text-xs text-[var(--text-muted)]">Agrega una nueva tarea a tu lista</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleAddTask} className="p-5 flex flex-col gap-4">
              <input
                type="text"
                placeholder="¿Qué necesitas hacer?"
                className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />

              <textarea
                placeholder="Descripción (opcional)"
                className="w-full border border-[var(--card-border)] rounded-xl px-4 py-3 bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-soft)]">Fecha límite</span>
                  <input
                    type="date"
                    className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-soft)]">Materia</span>
                  <select
                    className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
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

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-soft)]">Prioridad</span>
                  {canAccess('priorities') ? (
                    <select
                      className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                    >
                      <option value="high">Alta</option>
                      <option value="medium">Media</option>
                      <option value="low">Baja</option>
                    </select>
                  ) : (
                    <div className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--text-muted)] text-sm cursor-not-allowed">
                      Media <span className="text-[10px] text-[var(--accent)]">(Premium)</span>
                    </div>
                  )}
                </label>
              </div>

              <PremiumGate feature="tags">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-soft)]">Etiquetas (separadas por coma)</span>
                  <input
                    type="text"
                    className="border border-[var(--card-border)] rounded-xl px-4 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    value={newTaskTags}
                    onChange={(e) => setNewTaskTags(e.target.value)}
                    placeholder="parcial, tp, final..."
                  />
                </label>
              </PremiumGate>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--foreground)] font-medium hover:bg-[var(--card-bg)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity"
                >
                  Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TasksPageContent />
    </Suspense>
  );
}
