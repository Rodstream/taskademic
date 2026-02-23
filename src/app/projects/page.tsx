'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  FaProjectDiagram,
  FaPlus,
  FaUsers,
  FaClipboardList,
  FaCrown,
  FaTrash,
} from 'react-icons/fa';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  owner_id: string;
  created_at: string;
  member_count: number;
  task_count: number;
  done_count: number;
};

const COLORS = [
  '#80499d',
  '#ffba00',
  '#06d6a0',
  '#ff4d4d',
  '#3b82f6',
  '#f97316',
  '#ec4899',
  '#14b8a6',
];

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#80499d');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchProjects();
  }, [user]);

  async function fetchProjects() {
    setLoadingProjects(true);
    setError(null);

    const { data, error: fetchError } = await supabaseClient
      .from('projects')
      .select('id, name, description, color, owner_id, created_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError('No se pudieron cargar los proyectos.');
      setLoadingProjects(false);
      return;
    }

    const projectList = data ?? [];

    if (projectList.length === 0) {
      setProjects([]);
      setLoadingProjects(false);
      return;
    }

    const ids = projectList.map((p: { id: string }) => p.id);

    const [{ data: membersData }, { data: tasksData }] = await Promise.all([
      supabaseClient
        .from('project_members')
        .select('project_id')
        .in('project_id', ids),
      supabaseClient
        .from('project_tasks')
        .select('project_id, status')
        .in('project_id', ids),
    ]);

    const memberCounts: Record<string, number> = {};
    const taskCounts: Record<string, number> = {};
    const doneCounts: Record<string, number> = {};

    for (const m of membersData ?? []) {
      memberCounts[m.project_id] = (memberCounts[m.project_id] ?? 0) + 1;
    }
    for (const t of tasksData ?? []) {
      taskCounts[t.project_id] = (taskCounts[t.project_id] ?? 0) + 1;
      if (t.status === 'done') {
        doneCounts[t.project_id] = (doneCounts[t.project_id] ?? 0) + 1;
      }
    }

    setProjects(
      projectList.map((p: { id: string; name: string; description: string | null; color: string; owner_id: string; created_at: string }) => ({
        ...p,
        color: p.color || '#80499d',
        member_count: memberCounts[p.id] ?? 0,
        task_count: taskCounts[p.id] ?? 0,
        done_count: doneCounts[p.id] ?? 0,
      }))
    );

    setLoadingProjects(false);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('El nombre del proyecto es obligatorio.');
      return;
    }
    if (trimmedName.length > 60) {
      setFormError('El nombre no puede superar los 60 caracteres.');
      return;
    }

    setCreating(true);

    const { data: projectData, error: insertError } = await supabaseClient
      .from('projects')
      .insert({
        name: trimmedName,
        description: description.trim() || null,
        color,
        owner_id: user!.id,
      })
      .select()
      .single();

    if (insertError || !projectData) {
      setFormError('Error al crear el proyecto. Verificá que las tablas estén creadas en Supabase.');
      setCreating(false);
      return;
    }

    await supabaseClient
      .from('project_members')
      .insert({ project_id: projectData.id, user_id: user!.id, role: 'owner' });

    setCreating(false);
    setModalOpen(false);
    resetForm();
    fetchProjects();
  }

  async function handleDelete() {
    if (!projectToDelete) return;
    setDeleting(true);
    await supabaseClient.from('projects').delete().eq('id', projectToDelete.id);
    setDeleting(false);
    setProjectToDelete(null);
    fetchProjects();
  }

  function resetForm() {
    setName('');
    setDescription('');
    setColor('#80499d');
    setFormError(null);
  }

  if (loading || loadingProjects) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FaProjectDiagram className="text-[var(--accent)]" />
            Proyectos
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Coordiná proyectos grupales con tu equipo
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <FaPlus />
          Nuevo proyecto
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] text-sm">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FaProjectDiagram className="text-5xl text-[var(--text-muted)] mb-4 opacity-30" />
          <p className="text-[var(--text-muted)] font-medium mb-1">No tenés proyectos todavía</p>
          <p className="text-sm text-[var(--text-muted)] opacity-60 mb-6">
            Creá tu primer proyecto y agregá colaboradores
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <FaPlus />
            Crear primer proyecto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const isOwner = project.owner_id === user.id;
            const progress =
              project.task_count > 0
                ? Math.round((project.done_count / project.task_count) * 100)
                : 0;

            return (
              <div
                key={project.id}
                className="relative rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden hover:border-[var(--accent)]/40 transition-colors group"
              >
                {/* Color strip */}
                <div className="h-1.5 w-full" style={{ backgroundColor: project.color }} />

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h2 className="font-semibold text-sm leading-tight flex-1 pr-2">
                      {project.name}
                    </h2>
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setProjectToDelete(project);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-all p-1 shrink-0"
                        title="Eliminar proyecto"
                      >
                        <FaTrash size={11} />
                      </button>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <FaUsers size={10} />
                      {project.member_count} miembro{project.member_count !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaClipboardList size={10} />
                      {project.task_count} tarea{project.task_count !== 1 ? 's' : ''}
                    </span>
                    {isOwner && (
                      <span className="flex items-center gap-1 text-[var(--accent)]">
                        <FaCrown size={10} />
                        Owner
                      </span>
                    )}
                  </div>

                  {project.task_count > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                        <span>Progreso</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--card-border)]">
                        <div
                          className="h-1 rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <Link
                    href={`/projects/${project.id}`}
                    className="block w-full text-center py-1.5 px-3 rounded-lg border border-[var(--card-border)] hover:bg-white/5 text-xs font-medium transition-colors"
                  >
                    Abrir proyecto →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nuevo proyecto */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalOpen(false);
              resetForm();
            }
          }}
        >
          <div className="bg-[var(--background)] border border-[var(--card-border)] rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Nuevo proyecto</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Trabajo de Química"
                  maxLength={60}
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descripción del proyecto..."
                  rows={3}
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-transparent text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Color del proyecto</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c
                          ? 'ring-2 ring-offset-2 ring-[var(--foreground)] scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {formError && (
                <p className="text-[var(--danger)] text-sm">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-2 rounded-lg border border-[var(--card-border)] text-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {creating ? 'Creando...' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!projectToDelete}
        title="Eliminar proyecto"
        description={`¿Eliminar "${projectToDelete?.name}"? Se eliminarán todas las tareas y miembros del proyecto.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={() => setProjectToDelete(null)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
