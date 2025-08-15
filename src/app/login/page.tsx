'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      // Persistimos sesión con el contexto
      login(data.user, data.token);
      router.push('/tasks');
    } catch {
      alert('Error inesperado');
      setLoading(false);
    }
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Iniciar sesión</h1>

        <form onSubmit={handleLogin} style={styles.form}>
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
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 12 }}>
          ¿No tenés cuenta? <Link href="/register">Registrate</Link>
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
