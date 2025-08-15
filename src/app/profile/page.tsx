'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import RequireAuth from '@/components/RequireAuth';

export default function UserProfile() {
  const { user, logout } = useAuth();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Prefill con datos del usuario logueado
  useEffect(() => {
    if (user) {
      setNombre(user.name || '');
      setEmail(user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí luego conectamos a un PATCH /api/profile para actualizar nombre/contraseña
    setMensaje('Perfil actualizado con éxito.');
    setTimeout(() => setMensaje(''), 2500);
  };

  return (
    <RequireAuth>
      <section style={{ padding: '2rem' }}>
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '2rem',
            backgroundColor: '#f9fdfb',
            borderRadius: '12px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          {/* Header con “avatar” simple */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div
              aria-hidden
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#e6f5ec',
                color: '#57b87b',
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
                fontWeight: 700,
                boxShadow: '0 8px 20px rgba(87,184,123,0.25)',
              }}
              title="Avatar"
            >
              {nombre?.trim()?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>

          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem', color: '#210440' }}>
            Perfil del Usuario
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#555', marginBottom: '1.25rem' }}>
            Editá tu información personal.
          </p>

          {mensaje && (
            <div
              role="status"
              style={{
                backgroundColor: '#d1ecf1',
                color: '#0c5460',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                marginBottom: '1rem',
                border: '1px solid #bee5eb',
              }}
            >
              {mensaje}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={inputStyle}
            />

            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              disabled
              title="El email no es editable"
              style={{ ...inputStyle, background: '#f5f7f6', cursor: 'not-allowed' as const }}
            />

            <input
              type="password"
              placeholder="Nueva contraseña (opcional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button type="submit" style={buttonStyle}>
              Actualizar perfil
            </button>
          </form>

          {/* Datos rápidos y botón de logout */}
          <div style={{ marginTop: '1.25rem', color: '#444', fontSize: '0.95rem' }}>
            <p><strong>ID:</strong> {user?.id}</p>
            <p><strong>Email:</strong> {user?.email}</p>
          </div>

          <button
            onClick={logout}
            style={{
              marginTop: '1rem',
              background: '#d9534f',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '0.6rem 1rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </section>
    </RequireAuth>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.75rem',
  border: '1px solid #dfe5e2',
  borderRadius: '10px',
  fontSize: '1rem',
  width: '100%',
  background: '#fff',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.85rem 1.2rem',
  backgroundColor: '#57b87b',
  color: '#fff',
  border: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 6px 18px rgba(87,184,123,0.35)',
};
