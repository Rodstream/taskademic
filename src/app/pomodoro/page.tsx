'use client';

import React, { useState, useEffect } from 'react';

export default function UserProfile() {
  const DURACIONES = {
    pomodoro: 1500, // 25 minutos
    shortBreak: 300, // 5 minutos
    longBreak: 900 // 15 minutos
  };

  const [modo, setModo] = useState<'pomodoro' | 'shortBreak' | 'longBreak'>('pomodoro');
  const [estudiando, setEstudiando] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(DURACIONES.pomodoro);
  const [historial, setHistorial] = useState<string[]>([]);

  const progreso = ((DURACIONES[modo] - tiempoRestante) / DURACIONES[modo]) * 100;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (estudiando && tiempoRestante > 0) {
      timer = setTimeout(() => {
        setTiempoRestante(t => t - 1);
      }, 1000);
    } else if (tiempoRestante === 0) {
      setEstudiando(false);
      alert('⏰ ¡Tiempo finalizado!');
    }
    return () => clearTimeout(timer);
  }, [estudiando, tiempoRestante]);

  const cambiarModo = (nuevoModo: 'pomodoro' | 'shortBreak' | 'longBreak') => {
    setModo(nuevoModo);
    setTiempoRestante(DURACIONES[nuevoModo]);
    setEstudiando(false);
    setHistorial([]);
    agregarHistorial(`Cambio a modo ${nuevoModo === 'pomodoro' ? 'Pomodoro' : nuevoModo === 'shortBreak' ? 'Descanso Corto' : 'Descanso Largo'}`);
  };

  const iniciarEstudio = () => {
    setEstudiando(true);
    agregarHistorial('Inicio de temporizador');
  };

  const detenerEstudio = () => {
    setEstudiando(false);
    agregarHistorial('Pausa del temporizador');
  };

  const resetearTiempo = () => {
    setTiempoRestante(DURACIONES[modo]);
    setEstudiando(false);
    setHistorial([]);
    agregarHistorial('Reinicio del temporizador');
  };

  const agregarHistorial = (accion: string) => {
    const hora = new Date().toLocaleTimeString();
    setHistorial(prev => [...prev, `${accion} a las ${hora}`]);
  };

  const formatoTiempo = (segundos: number) => {
    const min = Math.floor(segundos / 60).toString().padStart(2, '0');
    const sec = (segundos % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  return (
    <section style={{ padding: '2rem' }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: '#f9fdfb',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '1rem', color: '#210440' }}>🧠 Modo de Estudio</h2>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => cambiarModo('pomodoro')} style={{ ...buttonStyle, minWidth: '160px' }}>Pomodoro</button>
          <button onClick={() => cambiarModo('shortBreak')} style={{ ...buttonStyle, minWidth: '160px' }}>Descanso Corto</button>
          <button onClick={() => cambiarModo('longBreak')} style={{ ...buttonStyle, minWidth: '160px' }}>Descanso Largo</button>
        </div>

        <svg width="140" height="140" viewBox="0 0 100 100" style={{ display: 'block', marginLeft: 'auto', marginRight: 'auto', marginBottom: '1.5rem' }}>
          <circle cx="50" cy="50" r="45" stroke="#e0e0e0" strokeWidth="10" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="#57b87b"
            strokeWidth="10"
            fill="none"
            strokeDasharray="282.6"
            strokeDashoffset={282.6 - (progreso / 100) * 282.6}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>

        <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1.5rem 0' }}>{formatoTiempo(tiempoRestante)}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {!estudiando && (
            <button onClick={iniciarEstudio} style={buttonStyle}>Iniciar</button>
          )}
          {estudiando && (
            <button onClick={detenerEstudio} style={{ ...buttonStyle, backgroundColor: '#f0ad4e' }}>Pausar</button>
          )}
          <button onClick={resetearTiempo} style={{ ...buttonStyle, backgroundColor: '#d9534f' }}>Reiniciar</button>
        </div>

        {historial.length > 0 && (
          <div style={{ marginTop: '2rem', textAlign: 'left' }}>
            <h4 style={{ color: '#210440', marginBottom: '0.5rem' }}>📜 Historial</h4>
            <ul style={{ listStyle: 'none', padding: 0, color: '#333' }}>
              {historial.map((item, index) => (
                <li key={index} style={{ marginBottom: '0.5rem' }}>• {item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

const buttonStyle = {
  marginTop: '0.5rem',
  padding: '0.75rem 1.5rem',
  backgroundColor: '#57b87b',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 500,
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease'
};
