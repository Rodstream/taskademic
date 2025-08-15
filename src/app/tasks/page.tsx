// src/app/tasks/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Si ya tenés AuthContext con token, descomentá estas 2 líneas.
// import { useAuth } from '@/context/AuthContext';
// const useAuthSafe = () => { try { return useAuth(); } catch { return { token: null } as any; } };

type Task = {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;   // ISO string
  completed: boolean;
};

function colorPorFecha(fechaISO: string) {
  const hoy = new Date();
  const f = new Date(fechaISO);
  const diff = (f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return '#f44336';   // rojo
  if (diff <= 3) return '#ff9800';   // naranja
  if (diff <= 7) return '#ffc107';   // amarillo
  return '#4CAF50';                  // verde
}

export default function TasksPage() {
  // const { token } = useAuthSafe();
  const token = null; // si usás AuthContext, reemplazá por la línea de arriba

  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const flash = (msg: string) => {
    setBanner(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setBanner(''), 2500);
  };

  const ordered = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }, [tasks]);

  // CARGAR
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/tasks', { headers, cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No autorizado');
        setTasks(data.tasks || []);
      } catch (e: any) {
        setError(e.message || 'Error al cargar tareas');
      } finally {
        setLoading(false);
      }
    })();
  }, [/* token */]);

  // CREAR
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError('Completá título y fecha.');
      return;
    }
    setError('');
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: new Date(dueDate).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Error al crear tarea');
    setTasks(prev => [data.task, ...prev]);
    setTitle(''); setDescription(''); setDueDate('');
    flash('Tarea agregada.');
  }

  // TOGGLE
  async function toggle(t: Task) {
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ completed: !t.completed }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Error al actualizar');
    setTasks(prev => prev.map(x => (x.id === t.id ? data.task : x)));
    flash(!t.completed ? 'Tarea completada.' : 'Tarea marcada como pendiente.');
  }

  // EDITAR
  function startEdit(t: Task) {
    setEditingId(t.id);
    setEditTitle(t.title);
    setEditDescription(t.description || '');
    setEditDueDate(t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '');
  }

  async function saveEdit(id: number) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        title: editTitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Error al editar');
    setTasks(prev => prev.map(x => (x.id === id ? data.task : x)));
    setEditingId(null);
    flash('Tarea actualizada.');
  }

  // ELIMINAR
  async function removeTask(id: number) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Error al eliminar');
    setTasks(prev => prev.filter(x => x.id !== id));
    flash('Tarea eliminada.');
  }

  const completadas = tasks.filter(t => t.completed).length;
  const progreso = tasks.length ? (completadas / tasks.length) * 100 : 0;

  return (
    <section style={{ padding: '2rem' }}>
      <div style={styles.card}>
        <h1 style={styles.title}>Gestor de tareas</h1>

        {banner && <div style={styles.banner}>{banner}</div>}
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={crear} style={styles.formRow}>
          <textarea
            placeholder="Nueva tarea"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ ...styles.input, flex: '1 1 250px', height: 45, resize: 'none' }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{ ...styles.input, flex: '0 0 170px' }}
          />
        </form>

        <textarea
          placeholder="Descripción"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ ...styles.input, width: '100%', minHeight: 60, marginTop: 12, resize: 'vertical' }}
        />

        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button type="submit" onClick={crear} style={styles.primary}>Agregar</button>
        </div>

        <div style={{ height: 10, background: '#ddd', borderRadius: 5, overflow: 'hidden', marginTop: 16 }}>
          <div style={{ height: '100%', background: '#57b87b', width: `${progreso}%`, transition: 'width .3s' }} />
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>Cargando…</p>
      ) : ordered.length === 0 ? (
        <p style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>No hay tareas.</p>
      ) : (
        <ul style={styles.grid}>
          {ordered.map(t => (
            <li key={t.id} style={{ ...styles.taskCard, opacity: t.completed ? .85 : 1 }}>
              {editingId === t.id ? (
                <>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="Título"
                    style={styles.input}
                  />
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="Descripción"
                    style={{ ...styles.input, minHeight: 80 }}
                  />
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                    style={styles.input}
                  />
                  <div style={styles.btnRow}>
                    <button onClick={() => saveEdit(t.id)} style={{ ...styles.btn, background: '#57b87b', color: '#fff' }}>Guardar</button>
                    <button onClick={() => setEditingId(null)} style={{ ...styles.btn, background: '#e9ecef' }}>Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <header style={styles.taskHeader}>
                    <label style={styles.checkLabel}>
                      <input type="checkbox" checked={t.completed} onChange={() => toggle(t)} />
                      <span style={{ textDecoration: t.completed ? 'line-through' : 'none', fontWeight: 700 }}>
                        {t.title}
                      </span>
                    </label>
                    <div style={styles.btnRow}>
                      <button onClick={() => startEdit(t)} style={{ ...styles.btn, background: '#0d6efd', color: '#fff' }}>Editar</button>
                      <button onClick={() => removeTask(t.id)} style={{ ...styles.btn, background: '#d9534f', color: '#fff' }}>Eliminar</button>
                    </div>
                  </header>

                  {t.description && <p style={{ color: '#333', marginTop: 6 }}>{t.description}</p>}

                  <footer style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.dueDate && (
                      <>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: colorPorFecha(t.dueDate) }} />
                        <span style={styles.badge(t)}>
                          {t.completed ? 'Completada' : `Vence ${new Date(t.dueDate).toLocaleDateString()}`}
                        </span>
                      </>
                    )}
                  </footer>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const styles: Record<string, any> = {
  card: { maxWidth: 900, margin: '0 auto', padding: '1.25rem', borderRadius: 16, background: '#f9fdfb', boxShadow: '0 20px 60px rgba(0,0,0,.12)' },
  title: { textAlign: 'center', fontSize: '1.9rem', color: '#210440', marginBottom: '1rem' },
  banner: { background: '#d1ecf1', color: '#0c5460', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #bee5eb', marginBottom: 10, textAlign: 'center' },
  error: { background: '#fdecea', color: '#b71c1c', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #f5c5c3', marginBottom: 10, textAlign: 'center' },
  formRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: { padding: '0.8rem 0.95rem', borderRadius: 10, border: '1px solid #dfe5e2', outline: 'none', background: '#fff' },
  primary: { padding: '0.85rem 1.4rem', borderRadius: 12, border: 'none', background: '#57b87b', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 18px rgba(87,184,123,.35)' },
  grid: { marginTop: 18, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', listStyle: 'none', padding: 0 },
  taskCard: { background: '#fff', border: '1px solid #e7eee9', borderRadius: 14, padding: '0.9rem 1rem', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  taskHeader: { display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  btnRow: { display: 'flex', gap: 8 },
  btn: { padding: '0.45rem 0.7rem', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  badge: (t: Task) => ({ fontSize: 12, padding: '0.3rem 0.55rem', borderRadius: 999, background: t.completed ? '#e6f5ec' : '#eef4ff', color: t.completed ? '#2e7d32' : '#2a4a8a', border: `1px solid ${t.completed ? '#cce9d7' : '#d6def8'}` }),
};
