'use client';

import { useState, useEffect, useRef } from 'react';

interface Tarea {
  id: number;
  texto: string;
  descripcion: string;
  fechaLimite: string;
  completada: boolean;
}

function getColorPorFecha(fecha: string): string {
  const hoy = new Date();
  const limite = new Date(fecha);
  const diferencia = (limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24);
  if (diferencia <= 1) return '#f44336';
  if (diferencia <= 3) return '#ff9800';
  if (diferencia <= 7) return '#ffc107';
  return '#4CAF50';
}

export default function TasksPage() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [nuevaTarea, setNuevaTarea] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [mensajeError, setMensajeError] = useState('');
  const [mensajeInfo, setMensajeInfo] = useState('');
  const [tareaEnEdicion, setTareaEnEdicion] = useState<Tarea | null>(null);
  const errorTimeout = useRef<NodeJS.Timeout | null>(null);
  const infoTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const almacenadas = localStorage.getItem('tareas');
    if (almacenadas) setTareas(JSON.parse(almacenadas));
  }, []);

  useEffect(() => {
    localStorage.setItem('tareas', JSON.stringify(tareas));
  }, [tareas]);

  const mostrarInfoTemporal = (mensaje: string) => {
    setMensajeInfo(mensaje);
    if (infoTimeout.current) clearTimeout(infoTimeout.current);
    infoTimeout.current = setTimeout(() => setMensajeInfo(''), 3000);
  };

  const agregarTarea = () => {
    if (nuevaTarea.trim() === '' || fechaLimite.trim() === '') {
      setMensajeError('Por favor completá el nombre y la fecha límite de la tarea.');
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
      errorTimeout.current = setTimeout(() => setMensajeError(''), 4000);
      return;
    }

    if (tareaEnEdicion) {
      const tareasActualizadas = tareas.map(t =>
        t.id === tareaEnEdicion.id
          ? { ...t, texto: nuevaTarea.trim(), descripcion: descripcion.trim(), fechaLimite }
          : t
      );
      setTareas(tareasActualizadas);
      setTareaEnEdicion(null);
      mostrarInfoTemporal('Tarea actualizada.');
    } else {
      const nueva: Tarea = {
        id: Date.now(),
        texto: nuevaTarea.trim(),
        descripcion: descripcion.trim(),
        fechaLimite,
        completada: false,
      };
      setTareas([nueva, ...tareas]);
      mostrarInfoTemporal('Tarea agregada.');
    }

    setNuevaTarea('');
    setDescripcion('');
    setFechaLimite('');
    setMensajeError('');
  };

  const toggleCompletada = (id: number) => {
    const tarea = tareas.find(t => t.id === id);
    if (tarea) {
      const mensaje = tarea.completada ? 'Tarea marcada como pendiente.' : 'Tarea completada.';
      mostrarInfoTemporal(mensaje);
    }
    setTareas(tareas.map(t => (t.id === id ? { ...t, completada: !t.completada } : t)));
  };

  const [tareaPendienteEliminar, setTareaPendienteEliminar] = useState<number | null>(null);

  const confirmarEliminar = () => {
    if (tareaPendienteEliminar !== null) {
      setTareas(tareas.filter(t => t.id !== tareaPendienteEliminar));
      mostrarInfoTemporal('Tarea eliminada.');
      setTareaPendienteEliminar(null);
    }
  };

  const cancelarEliminar = () => {
    setTareaPendienteEliminar(null);
  };

  const eliminarTarea = (id: number) => {
    setTareaPendienteEliminar(id);
  };

  const editarTarea = (tarea: Tarea) => {
    setNuevaTarea(tarea.texto);
    setDescripcion(tarea.descripcion);
    setFechaLimite(tarea.fechaLimite);
    setTareaEnEdicion(tarea);
  };

  const tareasCompletadas = tareas.filter(t => t.completada).length;
  const progreso = tareas.length > 0 ? (tareasCompletadas / tareas.length) * 100 : 0;

  return (
    <section style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto 2rem auto', padding: '2rem', backgroundColor: '#f9fdfb', borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#210440' }}>Gestor de tareas</h1>

        {mensajeError && (
          <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #f5c6cb' }}>{mensajeError}</div>
        )}

        {mensajeInfo && (
          <div style={{ backgroundColor: '#d1ecf1', color: '#0c5460', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #bee5eb' }}>{mensajeInfo}</div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
          <textarea placeholder="Nueva tarea" value={nuevaTarea} onChange={e => setNuevaTarea(e.target.value)} style={{ flex: '1 1 250px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.9rem', height: '45px', resize: 'none' }} />
          <input type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} style={{ flex: '1 1 150px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.9rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <textarea placeholder="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} style={{ padding: '0.75rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '1rem', width: '100%', minHeight: '60px', resize: 'vertical' }} />
          <button onClick={agregarTarea} style={{ alignSelf: 'center', backgroundColor: '#57b87b', color: '#fff', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>{tareaEnEdicion ? 'Actualizar' : 'Agregar'}</button>
        </div>
        <div style={{ height: '10px', backgroundColor: '#ddd', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ height: '100%', backgroundColor: '#57b87b', width: `${progreso}%`, transition: 'width 0.3s ease-in-out' }} />
        </div>
      </div>

      <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
        {tareas.map(t => (
          <li key={t.id} style={{ backgroundColor: t.completada ? '#e0f7e9' : '#ffffff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 'auto', minHeight: '230px', transition: 'all 0.3s ease' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.25rem', textDecoration: t.completada ? 'line-through' : 'none', color: t.completada ? '#999' : '#333' }}>{t.texto}</span>
            {t.descripcion && <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#666' }}>{t.descripcion}</p>}
            {t.fechaLimite && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: getColorPorFecha(t.fechaLimite) }} />
                <p style={{ fontSize: '0.9rem', color: '#555' }}>📅 {t.fechaLimite}</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <button onClick={() => toggleCompletada(t.id)} style={{ backgroundColor: t.completada ? '#ff9800' : '#4CAF50', color: t.completada ? '#000' : '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '1rem', marginRight: '0.5rem' }}>{t.completada ? '↺' : '✔'}</button>
                <button onClick={() => eliminarTarea(t.id)} style={{ backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
              <button onClick={() => editarTarea(t)} style={{ backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.9rem' }}>✎ Editar</button>
            </div>
          </li>
        ))}
      </ul>
    {tareaPendienteEliminar !== null && (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          maxWidth: '90%',
          width: '400px',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#210440' }}>¿Eliminar tarea?</h2>
          <p style={{ marginBottom: '1.5rem', color: '#444' }}>Esta acción no se puede deshacer.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button onClick={confirmarEliminar} style={{ backgroundColor: '#f44336', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}>Eliminar</button>
            <button onClick={cancelarEliminar} style={{ backgroundColor: '#ccc', color: '#000', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      </div>
    )}
  </section>
  );
}
