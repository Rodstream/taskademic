import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={styles.container}>
      {/* Hero principal */}
      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>Tu vida académica. Más simple.</h1>
        <p style={styles.heroSubtitle}>
          Con Taskademic, organizá tus trabajos, proyectos y grupos de estudio en un solo lugar. Eficiencia, claridad y control en cada materia.
        </p>
        <div style={styles.buttonGroup}>
          <Link href="/about" style={styles.primaryButton}>Conocé más</Link>
          <Link href="/contact" style={styles.secondaryButton}>Contacto</Link>
        </div>
      </section>

      {/* Beneficios clave */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>¿Por qué elegir Taskademic?</h2>
        <div style={styles.features}>
          <div style={styles.featureCard}>
            <h3 style={styles.featureTitle}>📚 Organización total</h3>
            <p style={styles.featureText}>Tené control absoluto de entregas, tareas y proyectos con una interfaz simple y efectiva.</p>
          </div>
          <div style={styles.featureCard}>
            <h3 style={styles.featureTitle}>🤝 Trabajo en equipo</h3>
            <p style={styles.featureText}>Gestioná tus grupos de estudio, asigná tareas y hacé seguimiento colaborativo de avances.</p>
          </div>
          <div style={styles.featureCard}>
            <h3 style={styles.featureTitle}>🎓 Pensado para estudiantes</h3>
            <p style={styles.featureText}>Diseñado desde cero por y para estudiantes universitarios y terciarios.</p>
          </div>
        </div>
      </section>

      {/* Cierre con llamado a la acción */}
      <section style={styles.cta}>
        <h2 style={styles.ctaTitle}>Empezá a usar Taskademic hoy</h2>
        <p style={styles.ctaText}>Organizate como un profesional. No pierdas más tiempo entre carpetas, correos y recordatorios sueltos.</p>
        <Link href="/contact" style={styles.ctaButton}>Contactanos</Link>
      </section>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '3rem 2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, sans-serif',
    backgroundColor: '#ffffff',
  },
  hero: {
    textAlign: 'center',
    padding: '4rem 1rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  heroTitle: {
    fontSize: '3rem',
    fontWeight: 700,
    color: '#210440',
    marginBottom: '1rem',
  },
  heroSubtitle: {
    fontSize: '1.25rem',
    color: '#444',
    marginBottom: '2rem',
    lineHeight: 1.6,
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#57b87b',
    color: '#fff',
    padding: '0.9rem 1.5rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem',
    transition: 'background-color 0.2s ease',
  },
  secondaryButton: {
    backgroundColor: '#eeeeee',
    color: '#333',
    padding: '0.9rem 1.5rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem',
    transition: 'background-color 0.2s ease',
  },
  section: {
    padding: '4rem 1rem',
    backgroundColor: '#f9fdfb',
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: '2rem',
    marginBottom: '3rem',
    color: '#210440',
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '2rem',
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.06)',
    padding: '2rem',
    width: '300px',
    textAlign: 'center',
  },
  featureTitle: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
    color: '#4CAF50',
  },
  featureText: {
    fontSize: '1rem',
    color: '#555',
    lineHeight: 1.6,
  },
  cta: {
    backgroundColor: '#e6f5ec',
    textAlign: 'center',
    padding: '4rem 1rem',
    marginTop: '4rem',
  },
  ctaTitle: {
    fontSize: '2rem',
    marginBottom: '1rem',
    color: '#210440',
  },
  ctaText: {
    fontSize: '1.1rem',
    marginBottom: '2rem',
    color: '#444',
  },
  ctaButton: {
    backgroundColor: '#57b87b',
    color: '#fff',
    padding: '1rem 2rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem',
    transition: 'background-color 0.2s ease',
  },
};
