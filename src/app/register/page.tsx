'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || undefined, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Error en el registro');
        setLoading(false);
        return;
      }

      // Persistimos sesión con el contexto
      login(data.user, data.token);
      router.push('/tasks');
    } catch (err) {
      alert('Error inesperado');
      setLoading(false);
    }
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Registro</h1>
        <form onSubmit={handleRegister} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Nombre (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Contraseña (mín. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Creando…' : 'Registrarse'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 12 }}>
          ¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>
        </p>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: '2rem' },
  card: {
    maxWidth: 420,
    margin: '0 auto',
    background: '#f9fdfb',
    borderRadius: 12,
    padding: '1.5rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  title: { marginBottom: '1rem', color: '#210440', textAlign: 'center' },
  form: { display: 'grid', gap: 10 },
  input: {
    padding: '0.85rem 1rem',
    borderRadius: 10,
    border: '1px solid #dfe5e2',
    outline: 'none',
    background: '#fff',
  },
  button: {
    padding: '0.9rem 1.2rem',
    borderRadius: 12,
    border: 'none',
    background: '#57b87b',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
