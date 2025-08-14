import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={styles.container}>
      {/* Hero */}
      <section style={styles.hero}>
        <span style={styles.tagline}>Taskademic</span>
        <h1 style={styles.heroTitle}>Organizá tu vida académica como nunca antes</h1>
        <p style={styles.heroSubtitle}>
          Unificá tus tareas, proyectos y sesiones de estudio en un solo lugar. Medí tu rendimiento y alcanzá tus metas con foco y claridad.
        </p>
        <div style={styles.buttonGroup}>
          <Link href="/tasks" style={styles.primaryButton}>Comenzar ahora</Link>
          <Link href="/about" style={styles.secondaryButton}>Saber más</Link>
        </div>
      </section>

      {/* Features */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>¿Por qué elegir Taskademic?</h2>
        <div style={styles.features}>
          <div style={styles.featureCard}>
            <h3 style={styles.featureTitle}>📚 Organización total</h3>
            <p style={styles.featureText}>
              Gestioná tareas, proyectos y entregas con una interfaz clara y eficiente.
            </p>
          </div>
          <div style={styles.featureCard}>
            <h3 style={styles.featureTitle}>⏱️ Pomodoro integrado</h3>
            <p style={styles.featureText}>
              Planificá sesiones de estudio con descansos programados y seguimiento de tiempo.
            </p>
          </div>
          <div style={styles.featureCard}>
            <h3 style={styles.featureTitle}>📊 Panel de rendimiento</h3>
            <p style={styles.featureText}>
              Analizá tu progreso con métricas de productividad y hábitos de estudio.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={styles.stats}>
        <div style={styles.statCard}>
          <h3 style={styles.statNumber}>+1.2k</h3>
          <p style={styles.statLabel}>Tareas completadas</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={styles.statNumber}>92%</h3>
          <p style={styles.statLabel}>Foco promedio</p>
        </div>
        <div style={styles.statCard}>
          <h3 style={styles.statNumber}>25 min</h3>
          <p style={styles.statLabel}>Pomodoro ideal</p>
        </div>
      </section>

      {/* CTA final */}
      <section style={styles.cta}>
        <h2 style={styles.ctaTitle}>Listo para tu mejor cuatrimestre</h2>
        <p style={styles.ctaText}>
          Empezá hoy mismo y llevá tu organización académica al siguiente nivel.
        </p>
        <Link href="/contact" style={styles.ctaButton}>Empezar gratis</Link>
      </section>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '0',
    fontFamily: 'system-ui, sans-serif',
    backgroundColor: '#fff',
    color: '#210440'
  },
  tagline: {
    display: 'inline-block',
    backgroundColor: 'rgba(87,184,123,0.15)',
    color: '#57b87b',
    padding: '0.4rem 0.8rem',
    borderRadius: '999px',
    fontWeight: 600,
    fontSize: '0.9rem',
    marginBottom: '1rem'
  },
  hero: {
    textAlign: 'center',
    padding: '5rem 1.5rem 4rem',
    maxWidth: '900px',
    margin: '0 auto',
  },
  heroTitle: {
    fontSize: '3rem',
    fontWeight: 800,
    marginBottom: '1rem',
    lineHeight: 1.2
  },
  heroSubtitle: {
    fontSize: '1.25rem',
    color: '#555',
    marginBottom: '2rem',
    lineHeight: 1.6,
    maxWidth: '700px',
    marginInline: 'auto'
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  primaryButton: {
    backgroundColor: '#57b87b',
    color: '#fff',
    padding: '0.9rem 1.6rem',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1rem'
  },
  secondaryButton: {
    backgroundColor: '#eeeeee',
    color: '#333',
    padding: '0.9rem 1.6rem',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '1rem'
  },
  section: {
    padding: '4rem 1rem',
    backgroundColor: '#f9fdfb'
  },
  sectionTitle: {
    textAlign: 'center',
    fontSize: '2rem',
    marginBottom: '3rem'
  },
  features: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '2rem'
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.06)',
    padding: '2rem',
    width: '300px',
    textAlign: 'center'
  },
  featureTitle: {
    fontSize: '1.2rem',
    marginBottom: '1rem',
    color: '#4CAF50'
  },
  featureText: {
    fontSize: '1rem',
    color: '#555',
    lineHeight: 1.6
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    padding: '3rem 1rem',
    flexWrap: 'wrap',
    backgroundColor: '#fff'
  },
  statCard: {
    backgroundColor: '#f3fdf7',
    padding: '1.5rem',
    borderRadius: '12px',
    textAlign: 'center',
    minWidth: '150px'
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    color: '#210440'
  },
  statLabel: {
    color: '#555',
    fontSize: '0.95rem'
  },
  cta: {
    backgroundColor: '#e6f5ec',
    textAlign: 'center',
    padding: '4rem 1rem'
  },
  ctaTitle: {
    fontSize: '2rem',
    marginBottom: '1rem'
  },
  ctaText: {
    fontSize: '1.1rem',
    marginBottom: '2rem',
    color: '#444'
  },
  ctaButton: {
    backgroundColor: '#57b87b',
    color: '#fff',
    padding: '1rem 2rem',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '1rem'
  }
};
