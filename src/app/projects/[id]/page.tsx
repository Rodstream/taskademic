'use client';

import { FormEvent, useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import Link from 'next/link';
import {
  FaArrowLeft,
  FaPlus,
  FaUsers,
  FaCrown,
  FaTrash,
  FaUserPlus,
  FaTimes,
  FaEdit,
} from 'react-icons/fa';

type Project = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  owner_id: string;
};

type ProjectMember = {
  id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  email: string;
};

type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  assigned_to: string | null;
  assigned_email: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
};

type TaskStatus = 'todo' | 'in_progress' | 'done';

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  done: 'Completado',
};

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--text-muted)',
  in_progress: 'var(--warn)',
  done: 'var(--success)',
};

const ALL_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done'];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Invite member
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Create task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  // Edit task modal
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('todo');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Confirm dialogs
  const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    fetchAll();
  }, [user, id]);

  async function fetchAll() {
    setLoadingData(true);
    setPageError(null);
    await Promise.all([fetchProject(), fetchMembers(), fetchTasks()]);
    setLoadingData(false);
  }

  async function fetchProject() {
    const { data, error } = await supabaseClient
      .from('projects')
      .select('id, name, description, color, owner_id')
      .eq('id', id)
      .single();

    if (error || !data) {
      setPageError('Proyecto no encontrado o sin acceso.');
    } else {
      setProject({ ...data, color: data.color || '#80499d' });
    }
  }

  async function fetchMembers() {
    const { data: memberData } = await supabaseClient
      .from('project_members')
      .select('id, user_id, role, joined_at')
      .eq('project_id', id)
      .order('joined_at', { ascending: true });

    if (!memberData) return;

    const userIds = memberData.map((m) => m.user_id);

    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const emailMap = new Map((profileData ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));

    setMembers(
      memberData.map((m) => ({
        ...m,
        email: emailMap.get(m.user_id) ?? m.user_id,
      }))
    );
  }

  async function fetchTasks() {
    const { data: taskData } = await supabaseClient
      .from('project_tasks')
      .select('id, project_id, title, description, status, assigned_to, due_date, created_by, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true });

    if (!taskData) return;

    const assigneeIds = Array.from(
      new Set(taskData.filter((t) => t.assigned_to).map((t) => t.assigned_to as string))
    );

    let emailMap = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('id, email')
        .in('id', assigneeIds);

      emailMap = new Map(
        (profileData ?? []).map((p: { id: string; email: string }) => [p.id, p.email])
      );
    }

    setTasks(
      taskData.map((t) => ({
        ...t,
        assigned_email: t.assigned_to ? (emailMap.get(t.assigned_to) ?? null) : null,
      }))
    );
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(false);

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError('Ingresá un email.');
      return;
    }

    setInviting(true);

    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single();

    if (profileError || !profileData) {
      setInviteError('No se encontró ningún usuario con ese email.');
      setInviting(false);
      return;
    }

    const alreadyMember = members.some((m) => m.user_id === profileData.id);
    if (alreadyMember) {
      setInviteError('Este usuario ya es miembro del proyecto.');
      setInviting(false);
      return;
    }

    const { error: insertError } = await supabaseClient
      .from('project_members')
      .insert({ project_id: id, user_id: profileData.id, role: 'member' });

    if (insertError) {
      setInviteError('Error al agregar el miembro.');
    } else {
      setInviteSuccess(true);
      setInviteEmail('');
      fetchMembers();
    }

    setInviting(false);
  }

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    setTaskFormError(null);

    const trimmedTitle = taskTitle.trim();
    if (!trimmedTitle) {
      setTaskFormError('El título es obligatorio.');
      return;
    }

    setCreatingTask(true);

    const { error } = await supabaseClient.from('project_tasks').insert({
      project_id: id,
      title: trimmedTitle,
      description: taskDesc.trim() || null,
      status: taskStatus,
      assigned_to: taskAssignee || null,
      due_date: taskDue || null,
      created_by: user!.id,
    });

    if (error) {
      setTaskFormError('Error al crear la tarea.');
    } else {
      setTaskModalOpen(false);
      resetTaskForm();
      fetchTasks();
    }

    setCreatingTask(false);
  }

  function openEditTask(task: ProjectTask) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description ?? '');
    setEditDue(task.due_date ?? '');
    setEditAssignee(task.assigned_to ?? '');
    setEditStatus(task.status);
    setEditFormError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    setEditFormError(null);

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditFormError('El título es obligatorio.');
      return;
    }
    if (!editingTask) return;

    setSavingEdit(true);

    const { error } = await supabaseClient
      .from('project_tasks')
      .update({
        title: trimmedTitle,
        description: editDesc.trim() || null,
        status: editStatus,
        assigned_to: editAssignee || null,
        due_date: editDue || null,
      })
      .eq('id', editingTask.id);

    if (error) {
      setEditFormError('Error al guardar los cambios.');
    } else {
      setEditingTask(null);
      fetchTasks();
    }

    setSavingEdit(false);
  }

  async function handleQuickStatus(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    await supabaseClient
      .from('project_tasks')
      .update({ status: newStatus })
      .eq('id', taskId);
  }

  async function handleDeleteTask() {
    if (!taskToDelete) return;
    setDeleting(true);
    await supabaseClient.from('project_tasks').delete().eq('id', taskToDelete.id);
    setDeleting(false);
    setTaskToDelete(null);
    fetchTasks();
  }

  async function handleRemoveMember() {
    if (!memberToRemove) return;
    setDeleting(true);
    await supabaseClient.from('project_members').delete().eq('id', memberToRemove.id);
    setDeleting(false);
    setMemberToRemove(null);
    fetchMembers();
  }

  function resetTaskForm() {
    setTaskTitle('');
    setTaskDesc('');
    setTaskDue('');
    setTaskAssignee('');
    setTaskStatus('todo');
    setTaskFormError(null);
  }

  const isOwner = project?.owner_id === user?.id;
  const tasksByStatus: Record<TaskStatus, ProjectTask[]> = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  };

  if (authLoading || loadingData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--danger)]">{pageError}</p>
        <Link href="/projects" className="text-sm text-[var(--accent)] underline">
          ← Volver a proyectos
        </Link>
      </div>
    );
  }

  if (!project) return null;

  const doneCount = tasksByStatus.done.length;
  const totalCount = tasks.length;
  const overallProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] mb-4 transition-colors"
        >
          <FaArrowLeft size={11} />
          Proyectos
        </Link>

        <div className="flex items-start gap-3">
          <div
            className="w-3 self-stretch rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: project.color }}
          />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-[var(--text-muted)] mt-0.5">{project.description}</p>
            )}

            {totalCount > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 max-w-xs h-1.5 rounded-full bg-[var(--card-border)]">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${overallProgress}%`, backgroundColor: project.color }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {doneCount}/{totalCount} completadas
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Kanban Board */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Tablero de tareas
            </h2>
            <button
              onClick={() => setTaskModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <FaPlus size={9} />
              Nueva tarea
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ALL_STATUSES.map((status) => (
              <div
                key={status}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 min-h-[200px]"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_DOT_COLORS[status] }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] flex-1">
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] opacity-60">
                    {tasksByStatus[status].length}
                  </span>
                </div>

                {/* Task cards */}
                <div className="flex flex-col gap-2">
                  {tasksByStatus[status].map((task) => (
                    <div
                      key={task.id}
                      className="group rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-3"
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <p className="text-xs font-medium leading-snug flex-1">{task.title}</p>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditTask(task)}
                            className="text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors p-0.5"
                            title="Editar"
                          >
                            <FaEdit size={9} />
                          </button>
                          {(isOwner || task.created_by === user?.id) && (
                            <button
                              onClick={() => setTaskToDelete(task)}
                              className="text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors p-0.5"
                              title="Eliminar"
                            >
                              <FaTimes size={9} />
                            </button>
                          )}
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-[10px] text-[var(--text-muted)] mb-1.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {task.assigned_email && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--foreground)]">
                            @{task.assigned_email.split('@')[0]}
                          </span>
                        )}
                        {task.due_date && (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            📅{' '}
                            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        )}
                      </div>

                      {/* Quick status change */}
                      <div className="flex gap-1 flex-wrap pt-1 border-t border-[var(--card-border)]">
                        {ALL_STATUSES.filter((s) => s !== status).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleQuickStatus(task.id, s)}
                            className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--card-border)] hover:bg-white/5 transition-colors text-[var(--text-muted)]"
                          >
                            → {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {tasksByStatus[status].length === 0 && (
                    <p className="text-[10px] text-[var(--text-muted)] text-center py-6 opacity-40">
                      Sin tareas
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Members Panel */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-4 flex items-center gap-2">
              <FaUsers size={11} />
              Miembros ({members.length})
            </h2>

            <div className="flex flex-col gap-2.5 mb-4">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-2.5 group">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                    style={{ backgroundColor: '#80499d' }}
                  >
                    {(member.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{member.email}</p>
                    {member.role === 'owner' && (
                      <span className="text-[9px] text-[var(--accent)] flex items-center gap-0.5">
                        <FaCrown size={7} />
                        Owner
                      </span>
                    )}
                  </div>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-all"
                      title="Quitar miembro"
                    >
                      <FaTimes size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Invite - only for owner */}
            {isOwner && (
              <div className="border-t border-[var(--card-border)] pt-4">
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5 text-[var(--text-muted)]">
                  <FaUserPlus size={10} />
                  Agregar por email
                </p>
                <form onSubmit={handleInvite} className="flex flex-col gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteError(null);
                      setInviteSuccess(false);
                    }}
                    placeholder="email@ejemplo.com"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] bg-transparent text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                  {inviteError && (
                    <p className="text-[10px] text-[var(--danger)]">{inviteError}</p>
                  )}
                  {inviteSuccess && (
                    <p className="text-[10px] text-[var(--success)]">✓ Miembro agregado correctamente</p>
                  )}
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full py-1.5 bg-[var(--primary)] text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {inviting ? 'Buscando...' : 'Agregar miembro'}
                  </button>
                </form>
              </div>
            )}

            {!isOwner && (
              <p className="text-[10px] text-[var(--text-muted)] text-center opacity-60 border-t border-[var(--card-border)] pt-3">
                Solo el owner puede agregar miembros
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Nueva tarea */}
      {taskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTaskModalOpen(false);
              resetTaskForm();
            }
          }}
        >
          <div className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Nueva tarea</h2>
            <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Título <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej: Revisar informe final"
                  maxLength={100}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-transparent text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Descripción{' '}
                  <span className="text-[var(--text-muted)] font-normal">(opcional)</span>
                </label>
                <textarea
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Detalles de la tarea..."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-transparent text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En progreso</option>
                    <option value="done">Completado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Asignar a</label>
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.email}
                    </option>
                  ))}
                </select>
              </div>

              {taskFormError && (
                <p className="text-[var(--danger)] text-sm">{taskFormError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTaskModalOpen(false);
                    resetTaskForm();
                  }}
                  className="flex-1 py-2 rounded-lg border border-[var(--card-border)] text-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {creatingTask ? 'Creando...' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar tarea */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingTask(null);
          }}
        >
          <div className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Editar tarea</h2>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Título *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={100}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-transparent text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-transparent text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En progreso</option>
                    <option value="done">Completado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Asignar a</label>
                <select
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--background)] text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.email}
                    </option>
                  ))}
                </select>
              </div>

              {editFormError && (
                <p className="text-[var(--danger)] text-sm">{editFormError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="flex-1 py-2 rounded-lg border border-[var(--card-border)] text-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {savingEdit ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!taskToDelete}
        title="Eliminar tarea"
        description={`¿Eliminar la tarea "${taskToDelete?.title}"?`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={() => setTaskToDelete(null)}
        onConfirm={handleDeleteTask}
      />

      <ConfirmDialog
        open={!!memberToRemove}
        title="Quitar miembro"
        description={`¿Quitar a ${memberToRemove?.email} del proyecto?`}
        confirmLabel="Quitar"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
      />
    </main>
  );
}
