'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

type Task = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null; // ISO
  completed: boolean;
};

function getColorPorFecha(iso?: string | null): string {
  if (!iso) return '#4CAF50';
  const hoy = new Date();
  const limite = new Date(iso);
  const diferencia = (limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diferencia <= 1) return '#f44336'; // rojo
  if (diferencia <= 3) return '#ff9800'; // naranja
  if (diferencia <= 7) return '#ffc107'; // amarillo
  return '#4CAF50'; // verde
}

export default function TasksPage() {
  const { token } = useAuth();
  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeInfo, setMensajeInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // edición
  const [tareaEnEdicion, setTareaEnEdicion] = useState<Task | null>(null);

  // modal eliminar
  const [tareaPendienteEliminar, setTareaPendienteEliminar] = useState<number | null>(null);

  const errorTimeout = useRef<NodeJS.Timeout | null>(null);
  const infoTimeout = useRef<NodeJS.Timeout | null>(null);

  function flashInfo(msg: string, ms = 3000) {
    setMensajeInfo(msg);
    if (infoTimeout.current) clearTimeout(infoTimeout.current);
    infoTimeout.current = setTimeout(() => setMensajeInfo(''), ms);
  }
  function flashError(msg: string, ms = 4000) {
    setMensajeError(msg);
    if (errorTimeout.current) clearTimeout(errorTimeout.current);
    errorTimeout.current = setTimeout(() => setMensajeError(''), ms);
  }

  // ------- API -------
  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', { headers: authHeaders, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No autorizado');
      setTasks(data.tasks || []);
    } catch (e: any) {
      flashError(e.message || 'Error al cargar tareas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function agregarOActualizarTarea() {
    if (nuevaTarea.trim() === '' || fechaLimite.trim() === '') {
      return flashError('Por favor completá el nombre y la fecha límite de la tarea.');
    }

    if (tareaEnEdicion) {
      // PATCH
      const res = await fetch(`/api/tasks/${tareaEnEdicion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          title: nuevaTarea.trim(),
          description: descripcion.trim() || undefined,
          dueDate: new Date(fechaLimite).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) return flashError(data.error || 'Error al actualizar');

      setTasks(prev => prev.map(t => (t.id === data.task.id ? data.task : t)));
      setTareaEnEdicion(null);
      setNuevaTarea('');
      setDescripcion('');
      setFechaLimite('');
      flashInfo('Tarea actualizada.');
      return;
    }

    // POST
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        title: nuevaTarea.trim(),
        description: descripcion.trim() || undefined,
        dueDate: new Date(fechaLimite).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) return flashError(data.error || 'Error al crear tarea');

    setTasks(prev => [data.task, ...prev]);
    setNuevaTarea('');
    setDescripcion('');
    setFechaLimite('');
    flashInfo('Tarea agregada.');
  }

  function editarTarea(t: Task) {
    setTareaEnEdicion(t);
    setNuevaTarea(t.title);
    setDescripcion(t.description || '');
    setFechaLimite(t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '');
  }

  async function toggleCompletada(t: Task) {
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ completed: !t.completed }),
    });
    const data = await res.json();
    if (!res.ok) return flashError(data.error || 'Error al actualizar');

    setTasks(prev => prev.map(x => (x.id === t.id ? data.task : x)));
    flashInfo(!t.completed ? 'Tarea completada.' : 'Tarea marcada como pendiente.');
  }

  function eliminarTarea(id: number) {
    setTareaPendienteEliminar(id);
  }
  function cancelarEliminar() {
    setTareaPendienteEliminar(null);
  }
  async function confirmarEliminar() {
    if (tareaPendienteEliminar === null) return;
    const res = await fetch(`/api/tasks/${tareaPendienteEliminar}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) {
      flashError(data.error || 'Error al eliminar');
    } else {
      setTasks(prev => prev.filter(t => t.id !== tareaPendienteEliminar));
      flashInfo('Tarea eliminada.');
    }
    setTareaPendienteEliminar(null);
  }

  const tareasCompletadas = useMemo(
    () => tasks.filter(t => t.completed).length,
    [tasks]
  );
  const progreso = tasks.length > 0 ? (tareasCompletadas / tasks.length) * 100 : 0;

  const ordered = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }, [tasks]);

  return (
    <section style={{ padding: '2rem' }}>
      <div
        style={{
          maxWidth: '700px',
          margin: '0 auto 2rem auto',
          padding: '2rem',
          backgroundColor: '#f9fdfb',
          borderRadius: '12px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#210440' }}>
          Gestor de tareas
        </h1>

        {mensajeError && (
          <div
            style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              border: '1px solid #f5c6cb',
            }}
          >
            {mensajeError}
          </div>
        )}

        {mensajeInfo && (
          <div
            style={{
              backgroundColor: '#d1ecf1',
              color: '#0c5460',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              border: '1px solid #bee5eb',
            }}
          >
            {mensajeInfo}
          </div>
        )}

        {/* inputs superiores (igual que tu UI) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1rem',
            justifyContent: 'center',
          }}
        >
          <textarea
            placeholder="Nueva tarea"
            value={nuevaTarea}
            onChange={e => setNuevaTarea(e.target.value)}
            style={{
              flex: '1 1 250px',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '0.9rem',
              height: '45px',
              resize: 'none',
            }}
          />
          <input
            type="date"
            value={fechaLimite}
            onChange={e => setFechaLimite(e.target.value)}
            style={{
              flex: '1 1 150px',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <textarea
            placeholder="Descripción"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '1rem',
              width: '100%',
              minHeight: '60px',
              resize: 'vertical',
            }}
          />
          <button
            onClick={agregarOActualizarTarea}
            style={{
              alignSelf: 'center',
              backgroundColor: '#57b87b',
              color: '#fff',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {tareaEnEdicion ? 'Actualizar' : 'Agregar'}
          </button>
        </div>

        {/* barra de progreso */}
        <div style={{ height: '10px', backgroundColor: '#ddd', borderRadius: '5px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              backgroundColor: '#57b87b',
              width: `${progreso}%`,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>
      </div>

      {/* grid de cards */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#666' }}>Cargando…</p>
      ) : (
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.5rem',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {ordered.map(t => (
            <li
              key={t.id}
              style={{
                backgroundColor: t.completed ? '#e0f7e9' : '#ffffff',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '230px',
                transition: 'all 0.3s ease',
              }}
            >
              <span
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  marginBottom: '0.25rem',
                  textDecoration: t.completed ? 'line-through' : 'none',
                  color: t.completed ? '#999' : '#333',
                }}
              >
                {t.title}
              </span>

              {t.description && (
                <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#666' }}>{t.description}</p>
              )}

              {t.dueDate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: getColorPorFecha(t.dueDate),
                    }}
                  />
                  <p style={{ fontSize: '0.9rem', color: '#555' }}>
                    📅 {new Date(t.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <button
                    onClick={() => toggleCompletada(t)}
                    style={{
                      backgroundColor: t.completed ? '#ff9800' : '#4CAF50',
                      color: t.completed ? '#000' : '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.8rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      marginRight: '0.5rem',
                    }}
                    title={t.completed ? 'Revertir' : 'Completar'}
                  >
                    {t.completed ? '↺' : '✔'}
                  </button>
                  <button
                    onClick={() => eliminarTarea(t.id)}
                    style={{
                      backgroundColor: '#f44336',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.4rem 0.8rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
                <button
                  onClick={() => editarTarea(t)}
                  style={{
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.4rem 0.8rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                  title="Editar"
                >
                  ✎ Editar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* modal de confirmación */}
      {tareaPendienteEliminar !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              maxWidth: '90%',
              width: '400px',
              textAlign: 'center',
            }}
          >
            <h2 style={{ marginBottom: '1rem', color: '#210440' }}>¿Eliminar tarea?</h2>
            <p style={{ marginBottom: '1.5rem', color: '#444' }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={confirmarEliminar}
                style={{
                  backgroundColor: '#f44336',
                  color: '#fff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Eliminar
              </button>
              <button
                onClick={cancelarEliminar}
                style={{
                  backgroundColor: '#ccc',
                  color: '#000',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
