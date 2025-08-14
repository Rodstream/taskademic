'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    mensaje: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Mensaje enviado con éxito');
    // Aquí iría la lógica real de envío
    setFormData({ nombre: '', email: '', mensaje: '' });
  };

  return (
    <section style={styles.container}>
      <h1 style={styles.title}>Contacto</h1>
      <p style={styles.subtitle}>¿Tenés alguna pregunta o propuesta? Escribinos.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          name="nombre"
          placeholder="Tu nombre"
          value={formData.nombre}
          onChange={handleChange}
          style={styles.input}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Tu email"
          value={formData.email}
          onChange={handleChange}
          style={styles.input}
          required
        />
        <textarea
          name="mensaje"
          placeholder="Escribí tu mensaje..."
          rows={5}
          value={formData.mensaje}
          onChange={handleChange}
          style={styles.textarea}
          required
        />
        <button type="submit" style={styles.button}>Enviar mensaje</button>
      </form>
    </section>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: '#f9fdfb',
    borderRadius: '12px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
    color: '#210440',
  },
  subtitle: {
    fontSize: '1rem',
    marginBottom: '2rem',
    color: '#555',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem',
  },
  input: {
    padding: '0.8rem 1rem',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '1rem',
  },
  textarea: {
    padding: '1rem',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '1rem',
  },
  button: {
  backgroundColor: '#57b87b', 
  color: '#fff',
  padding: '0.9rem',
  border: 'none',
  borderRadius: '6px',
  fontSize: '1rem',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease, transform 0.1s ease',
  fontWeight: 500,
},

buttonHover: {
  backgroundColor: '#479b66',
},

};
