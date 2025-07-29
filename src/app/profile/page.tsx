'use client';

import React, { useState } from 'react';

export default function UserProfile() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje('Perfil actualizado con éxito.');
  };

  return (
    <section style={{ padding: '2rem' }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '2rem',
        backgroundColor: '#f9fdfb',
        borderRadius: '12px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#210440' }}>Perfil del Usuario</h1>
        <p style={{ fontSize: '1rem', color: '#555', marginBottom: '1.5rem' }}>
          Editá tu información personal.
        </p>

        {mensaje && (
          <div style={{ backgroundColor: '#d1ecf1', color: '#0c5460', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #bee5eb' }}>{mensaje}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Nombre completo"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle}>Actualizar perfil</button>
        </form>
      </div>
    </section>
  );
}

const inputStyle = {
  padding: '0.75rem',
  border: '1px solid #ccc',
  borderRadius: '6px',
  fontSize: '1rem',
  width: '100%'
};

const buttonStyle = {
  marginTop: '1rem',
  padding: '0.75rem 1.5rem',
  backgroundColor: '#57b87b',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 500,
  cursor: 'pointer'
};
