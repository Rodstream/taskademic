'use client';

import Link from 'next/link';
import { usePlan } from '@/context/PlanContext';

const FREE_FEATURES = [
  'Hasta 5 materias',
  'Hasta 20 tareas activas',
  'Calendario mensual',
  'Notas de exámenes',
  'Pomodoro básico',
  'Modo oscuro',
];

const PREMIUM_FEATURES = [
  'Materias ilimitadas',
  'Tareas activas ilimitadas',
  'Subtareas (checklists)',
  'Etiquetas personalizadas',
  'Prioridades (alta, media, baja)',
  'Filtros avanzados',
  'Gráficos de rendimiento',
  'Pomodoro vinculado a tareas',
  'Exportar datos (CSV)',
  'Todo lo del plan gratuito',
];

export default function PricingPage() {
  const { isPremium } = usePlan();

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">
      {/* Header */}
      <header className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
          Planes
        </h1>
        <p className="text-[var(--text-muted)] max-w-md mx-auto">
          Elige el plan que mejor se adapte a tus necesidades académicas
        </p>
      </header>

      {/* Cards de planes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plan Gratis */}
        <div className="border border-[var(--card-border)] rounded-2xl p-6 bg-[var(--card-bg)] flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">
              Gratis
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Organización básica para empezar
            </p>
          </div>

          <div className="mb-6">
            <span className="text-4xl font-bold text-[var(--foreground)]">$0</span>
            <span className="text-[var(--text-muted)] ml-1">/mes</span>
          </div>

          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                <svg className="w-5 h-5 text-[var(--success)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          {!isPremium ? (
            <div className="px-6 py-3 rounded-xl border border-[var(--card-border)] text-center text-sm font-medium text-[var(--text-muted)]">
              Plan actual
            </div>
          ) : (
            <div className="px-6 py-3 rounded-xl border border-[var(--card-border)] text-center text-sm text-[var(--text-muted)]">
              Plan básico
            </div>
          )}
        </div>

        {/* Plan Premium */}
        <div className="relative border-2 border-[var(--accent)] rounded-2xl p-6 bg-[var(--card-bg)] flex flex-col">
          {/* Badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--accent)] text-[var(--foreground)] text-xs font-bold">
            Recomendado
          </div>

          <div className="mb-6 mt-2">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">
              Premium
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Control total de tu rendimiento académico
            </p>
          </div>

          <div className="mb-6">
            <span className="text-4xl font-bold text-[var(--foreground)]">$2.99</span>
            <span className="text-[var(--text-muted)] ml-1">/mes</span>
          </div>

          <ul className="flex flex-col gap-3 mb-8 flex-1">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          {isPremium ? (
            <div className="px-6 py-3 rounded-xl bg-[var(--accent)]/20 text-center text-sm font-semibold text-[var(--accent)]">
              Plan actual
            </div>
          ) : (
            <button
              onClick={() => alert('Próximamente: integración de pagos.')}
              className="px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity text-center"
            >
              Mejorar a Premium
            </button>
          )}
        </div>
      </section>

      {/* FAQ / info */}
      <section className="text-center">
        <p className="text-sm text-[var(--text-muted)]">
          ¿Tenés preguntas? Escribinos a{' '}
          <a href="mailto:soporte@taskademic.com" className="text-[var(--accent)] hover:underline">
            soporte@taskademic.com
          </a>
        </p>
        <Link
          href="/"
          className="inline-block mt-4 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
