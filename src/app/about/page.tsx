export default function AboutPage() {
  return (
    <section style={styles.container}>
      <h1 style={styles.title}>Sobre Taskademic</h1>

      {/* Introducción */}
      <p style={styles.paragraph}>
        Taskademic es una plataforma digital integral diseñada para transformar la manera en que los estudiantes universitarios y terciarios gestionan sus actividades académicas. Nace como respuesta a una necesidad concreta: la ausencia de una herramienta centralizada que permita organizar trabajos prácticos, coordinar proyectos en grupo, visualizar el progreso y mejorar la productividad académica de forma profesional.
      </p>
      <p style={styles.paragraph}>
        Desarrollado como proyecto final de Ingeniería en Sistemas en la Facultad de Tecnología Informática (UAI), Taskademic combina planificación, colaboración y seguimiento en una sola experiencia digital, con un enfoque centrado completamente en la experiencia real del estudiante.
      </p>

      {/* Visión y misión */}
      <h2 style={styles.subtitle}>Nuestra visión y misión</h2>
      <p style={styles.paragraph}>
        Nuestra misión es empoderar a cada estudiante para que tenga el control total de su vida académica, brindándole herramientas intuitivas, organizadas y efectivas que potencien su rendimiento, comunicación y planificación.
      </p>
      <p style={styles.paragraph}>
        Nuestra visión es posicionarnos como la plataforma de gestión académica de referencia en el ámbito educativo hispanoamericano, integrándonos también con instituciones que buscan adoptar metodologías tecnológicas orientadas al orden y la eficiencia.
      </p>

      {/* Equipo */}
      <h2 style={styles.subtitle}>Nuestro equipo</h2>
      <p style={styles.paragraph}>
        Taskademic fue concebido y desarrollado por un equipo interdisciplinario de estudiantes de Ingeniería en Sistemas, apasionados por la educación, la tecnología y el diseño centrado en el usuario. Cada decisión de diseño, funcionalidad y arquitectura responde a problemáticas reales vividas durante la vida universitaria.
      </p>
      <ul style={styles.list}>
        <li><strong>Desarrollo Frontend:</strong> interfaz simple, responsiva y amigable.</li>
        <li><strong>Arquitectura Backend:</strong> segura, escalable y preparada para crecimiento institucional.</li>
        <li><strong>Diseño UX/UI:</strong> centrado en el estudiante como eje de interacción.</li>
      </ul>

      {/* Valores */}
      <h2 style={styles.subtitle}>Valores que nos guían</h2>
      <ul style={styles.list}>
        <li>🎯 <strong>Claridad:</strong> herramientas simples que no abruman.</li>
        <li>🤝 <strong>Colaboración:</strong> fomentar el trabajo grupal y la comunicación entre pares.</li>
        <li>📈 <strong>Productividad:</strong> foco en la organización y el seguimiento.</li>
        <li>🌱 <strong>Escalabilidad:</strong> diseño adaptable a instituciones educativas.</li>
      </ul>

      {/* Línea de tiempo */}
      <h2 style={styles.subtitle}>Nuestra línea de desarrollo</h2>
      <ul style={styles.timeline}>
        <li><strong>Marzo 2024:</strong> Idea inicial en base a experiencias académicas reales.</li>
        <li><strong>Abril - Mayo 2024:</strong> Primeros prototipos, validación con usuarios.</li>
        <li><strong>Julio 2024:</strong> Diseño de arquitectura y planificación iterativa.</li>
        <li><strong>Agosto - Octubre 2024:</strong> Desarrollo funcional, pruebas internas.</li>
        <li><strong>Diciembre 2024:</strong> Presentación oficial como Trabajo Final de Ingeniería.</li>
        <li><strong>2025 en adelante:</strong> Proyección institucional y expansión.</li>
      </ul>
    </section>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '850px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: '#f9fdfb',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  title: {
    fontSize: '2.2rem',
    marginBottom: '1.5rem',
    color: '#210440',
  },
  subtitle: {
    fontSize: '1.4rem',
    marginTop: '2rem',
    marginBottom: '1rem',
    color: '#4CAF50',
  },
  paragraph: {
    fontSize: '1.05rem',
    lineHeight: 1.8,
    color: '#333',
    marginBottom: '1.5rem',
  },
  list: {
    marginLeft: '1.5rem',
    marginBottom: '1.5rem',
    color: '#444',
    lineHeight: 1.7,
    fontSize: '1rem',
  },
  timeline: {
    marginLeft: '1.5rem',
    paddingLeft: '0.5rem',
    borderLeft: '2px solid #57b87b',
    listStyle: 'none',
    lineHeight: 1.8,
    color: '#444',
  },
};
