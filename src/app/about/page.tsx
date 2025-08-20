export default function AboutPage() {
  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.title}>
            Sobre <span style={styles.titleAccent}>Taskademic</span>
          </h1>
          <p style={styles.heroSubtitle}>
            La plataforma que revoluciona la gestión académica universitaria
          </p>
        </div>
        <div style={styles.heroDecoration}></div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Introducción */}
        <section style={{...styles.section, backgroundColor: '#f8f9fa'}}>
          <div style={styles.sectionContent}>
            <p style={styles.leadParagraph}>
              <strong>Taskademic</strong> es mucho más que una herramienta de organización. Es la solución integral que los estudiantes universitarios necesitaban: una plataforma que centraliza la gestión de trabajos prácticos, facilita la colaboración en proyectos grupales y potencia la productividad académica.
            </p>
            <p style={styles.paragraph}>
              Nacido en las aulas de la Facultad de Tecnología Informática (UAI) como proyecto final de Ingeniería en Sistemas, Taskademic surge de experiencias reales de estudiantes que enfrentaron los desafíos diarios de la vida universitaria. No es solo teoría: es práctica pura.
            </p>
          </div>
        </section>

        {/* Visión y misión */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.titleIcon}>🎯</span>
            Visión & Misión
          </h2>
          <div style={styles.visionMissionGrid}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Nuestra Misión</h3>
              <p style={styles.cardText}>
                Empoderar a cada estudiante con herramientas intuitivas y efectivas que transformen su experiencia académica, mejoren su rendimiento y faciliten la colaboración con sus pares.
              </p>
            </div>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Nuestra Visión</h3>
              <p style={styles.cardText}>
                Ser la plataforma de gestión académica líder en Hispanoamérica, integrándose con instituciones que buscan la excelencia educativa a través de la tecnología.
              </p>
            </div>
          </div>
        </section>

        {/* Valores */}
        <section style={{...styles.section, backgroundColor: '#f8f9fa'}}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.titleIcon}>⭐</span>
            Nuestros Valores
          </h2>
          <div style={styles.valuesGrid}>
            <div style={styles.valueCard}>
              <div style={styles.valueIcon}>🎯</div>
              <h3 style={styles.valueTitle}>Claridad</h3>
              <p style={styles.valueText}>Interfaces simples e intuitivas que no abruman, sino que facilitan.</p>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueIcon}>🤝</div>
              <h3 style={styles.valueTitle}>Colaboración</h3>
              <p style={styles.valueText}>Fomentamos el trabajo en equipo y la comunicación efectiva.</p>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueIcon}>📈</div>
              <h3 style={styles.valueTitle}>Productividad</h3>
              <p style={styles.valueText}>Herramientas enfocadas en maximizar tu rendimiento académico.</p>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueIcon}>🌱</div>
              <h3 style={styles.valueTitle}>Escalabilidad</h3>
              <p style={styles.valueText}>Diseño adaptable desde estudiantes individuales hasta instituciones.</p>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueIcon}>🔒</div>
              <h3 style={styles.valueTitle}>Confianza</h3>
              <p style={styles.valueText}>Seguridad y privacidad de datos como pilares fundamentales.</p>
            </div>
            <div style={styles.valueCard}>
              <div style={styles.valueIcon}>💡</div>
              <h3 style={styles.valueTitle}>Innovación</h3>
              <p style={styles.valueText}>Soluciones creativas basadas en las necesidades reales del estudiante.</p>
            </div>
          </div>
        </section>

        {/* Equipo */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            <span style={styles.titleIcon}>👥</span>
            Nuestro Equipo
          </h2>
          <div style={styles.sectionContent}>
            <p style={styles.paragraph}>
              Taskademic es el resultado del talento y la pasión de un equipo interdisciplinario de estudiantes de Ingeniería en Sistemas. Cada línea de código, cada decisión de diseño y cada funcionalidad nace de problemáticas reales vividas en primera persona durante nuestros años universitarios.
            </p>
            <div style={styles.expertiseGrid}>
              <div style={styles.expertiseItem}>
                <span style={styles.expertiseIcon}>⚡</span>
                <div>
                  <strong style={styles.expertiseTitle}>Frontend Development</strong>
                  <p style={styles.expertiseDesc}>Interfaces responsivas, modernas y centradas en la experiencia del usuario</p>
                </div>
              </div>
              <div style={styles.expertiseItem}>
                <span style={styles.expertiseIcon}>🏗️</span>
                <div>
                  <strong style={styles.expertiseTitle}>Arquitectura Backend</strong>
                  <p style={styles.expertiseDesc}>Sistemas seguros, escalables y preparados para el crecimiento institucional</p>
                </div>
              </div>
              <div style={styles.expertiseItem}>
                <span style={styles.expertiseIcon}>🎨</span>
                <div>
                  <strong style={styles.expertiseTitle}>UX/UI Design</strong>
                  <p style={styles.expertiseDesc}>Diseño centrado en el estudiante como protagonista de cada interacción</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section style={styles.ctaSection}>
          <div style={styles.ctaContent}>
            <h2 style={styles.ctaTitle}>¿Listo para transformar tu experiencia académica?</h2>
            <p style={styles.ctaText}>
              Únete a los estudiantes que ya están optimizando su rendimiento con Taskademic
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
  },
  
  hero: {
    padding: '4rem 2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  
  heroContent: {
    maxWidth: '1000px',
    margin: '0 auto',
    textAlign: 'center',
    position: 'relative',
    zIndex: 2,
  },
  
  heroDecoration: {
    position: 'absolute',
    top: '50%',
    right: '-10%',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    transform: 'translateY(-50%)',
  },
  
  title: {
    fontSize: '3.5rem',
    fontWeight: '800',
    color: '#2d3748',
    marginBottom: '1rem',
    textShadow: 'none',
  },
  
  titleAccent: {
    background: 'linear-gradient(45deg, #4CAF50, #81C784)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  
  heroSubtitle: {
    fontSize: '1.3rem',
    color: '#718096',
    fontWeight: '300',
    maxWidth: '600px',
    margin: '0 auto',
  },
  
  content: {
    padding: '0',
  },
  
  section: {
    padding: '4rem 2rem',
    marginBottom: '0',
  },
  
  sectionContent: {
    maxWidth: '1000px',
    margin: '0 auto',
  },
  
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: '2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textAlign: 'center',
    justifyContent: 'center',
    maxWidth: '1000px',
    margin: '0 auto 2rem auto',
  },
  
  titleIcon: {
    fontSize: '1.5rem',
  },
  
  leadParagraph: {
    fontSize: '1.25rem',
    lineHeight: 1.8,
    color: '#4a5568',
    marginBottom: '1.5rem',
    fontWeight: '400',
  },
  
  paragraph: {
    fontSize: '1.1rem',
    lineHeight: 1.7,
    color: '#718096',
    marginBottom: '1.5rem',
  },
  
  visionMissionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '2rem',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  
  card: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  
  cardTitle: {
    fontSize: '1.4rem',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '1rem',
  },
  
  cardText: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#718096',
  },
  
  valuesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  
  valueCard: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    textAlign: 'center',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  
  valueIcon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    display: 'block',
  },
  
  valueTitle: {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '0.5rem',
  },
  
  valueText: {
    fontSize: '0.95rem',
    color: '#718096',
    lineHeight: 1.5,
  },
  
  expertiseGrid: {
    display: 'grid',
    gap: '1.5rem',
    marginTop: '2rem',
  },
  
  expertiseItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '12px',
    backgroundColor: 'rgba(102, 126, 234, 0.05)',
  },
  
  expertiseIcon: {
    fontSize: '1.5rem',
    marginTop: '0.2rem',
  },
  
  expertiseTitle: {
    fontSize: '1.1rem',
    color: '#2d3748',
    display: 'block',
    marginBottom: '0.5rem',
  },
  
  expertiseDesc: {
    fontSize: '0.95rem',
    color: '#718096',
    lineHeight: 1.5,
    margin: 0,
  },
  
  timeline: {
    position: 'relative',
    paddingLeft: '2rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  
  timelineItem: {
    display: 'flex',
    marginBottom: '2.5rem',
    position: 'relative',
  },
  
  timelineDate: {
    minWidth: '120px',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#667eea',
    paddingTop: '0.2rem',
  },
  
  timelineContent: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
    marginLeft: '1rem',
    flex: 1,
    position: 'relative',
  },
  
  timelineTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: '0.5rem',
  },
  
  timelineText: {
    fontSize: '0.95rem',
    color: '#718096',
    lineHeight: 1.5,
    margin: 0,
  },
  
  ctaSection: {
    background: 'linear-gradient(135deg, #4CAF50 0%, #81C784 100%)',
    borderRadius: '20px',
    padding: '3rem',
    textAlign: 'center',
    marginTop: '3rem',
  },
  
  ctaContent: {
    maxWidth: '600px',
    margin: '0 auto',
  },
  
  ctaTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'white',
    marginBottom: '1rem',
  },
  
  ctaText: {
    fontSize: '1.1rem',
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 1.6,
    margin: 0,
  },
};