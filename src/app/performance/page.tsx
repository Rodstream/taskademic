'use client';

import Image from 'next/image';
import React from 'react';

export default function PerformancePage() {
  // Datos simulados – reemplazables en el futuro por conexión real
  const sesionesPomodoro = 12;
  const sesionesShort = 6;
  const sesionesLong = 3;

  const totalSesiones = sesionesPomodoro + sesionesShort + sesionesLong;
  const duracionPomodoro = sesionesPomodoro * 25;
  const duracionShort = sesionesShort * 5;
  const duracionLong = sesionesLong * 15;
  const duracionTotal = duracionPomodoro + duracionShort + duracionLong;

  const modoMasUsado = () => {
    const max = Math.max(sesionesPomodoro, sesionesShort, sesionesLong);
    if (max === sesionesPomodoro) return 'Pomodoro';
    if (max === sesionesShort) return 'Descanso Corto';
    return 'Descanso Largo';
  };

  return (
    <section style={{ padding: '2rem' }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: '#f9fdfb',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '1rem', color: '#210440' }}>📊 Panel de Rendimiento</h2>

        <div style={{ textAlign: 'left', marginTop: '1rem' }}>
          <p><strong>Sesiones Pomodoro:</strong> {sesionesPomodoro}</p>
          <p><strong>Sesiones de Descanso Corto:</strong> {sesionesShort}</p>
          <p><strong>Sesiones de Descanso Largo:</strong> {sesionesLong}</p>
          <hr style={{ margin: '1rem 0' }} />
          <p><strong>Total de sesiones:</strong> {totalSesiones}</p>
          <p><strong>Modo más utilizado:</strong> {modoMasUsado()}</p>
          <p><strong>Tiempo acumulado Pomodoro:</strong> {duracionPomodoro} minutos</p>
          <p><strong>Tiempo acumulado Descansos:</strong> {duracionShort + duracionLong} minutos</p>
          <p><strong>⏱ Tiempo total acumulado:</strong> {duracionTotal} minutos</p>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h4 style={{ color: '#210440', marginBottom: '1rem' }}>🧁 Distribución de sesiones</h4>
          <Image
            src="/grafico_rendimiento_taskademic.png"
            alt="Gráfico de sesiones"
            width={400}
            height={400}
          />
        </div>
      </div>
    </section>
  );
}
