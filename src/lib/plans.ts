// Sistema de planes Freemium de Taskademic
//
// REQUISITO: Ejecutar en Supabase SQL Editor:
// ALTER TABLE profiles ADD COLUMN plan text NOT NULL DEFAULT 'free';
// ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'premium'));

export type Plan = 'free' | 'premium';

export type PremiumFeature =
  | 'subtasks'
  | 'tags'
  | 'priorities'
  | 'performance_charts'
  | 'advanced_filters'
  | 'export'
  | 'pomodoro_link';

export type LimitedResource = 'courses' | 'active_tasks';

export const PLAN_LIMITS: Record<LimitedResource, { free: number; premium: number }> = {
  courses: { free: 5, premium: Infinity },
  active_tasks: { free: 20, premium: Infinity },
};

const PREMIUM_FEATURES: Set<PremiumFeature> = new Set([
  'subtasks',
  'tags',
  'priorities',
  'performance_charts',
  'advanced_filters',
  'export',
  'pomodoro_link',
]);

export const FEATURE_LABELS: Record<PremiumFeature, { title: string; description: string }> = {
  subtasks: {
    title: 'Subtareas',
    description: 'Divide tus tareas en pasos más pequeños con checklists.',
  },
  tags: {
    title: 'Etiquetas',
    description: 'Organiza tus tareas con etiquetas personalizadas.',
  },
  priorities: {
    title: 'Prioridades',
    description: 'Asigna prioridad alta, media o baja a tus tareas.',
  },
  performance_charts: {
    title: 'Gráficos de rendimiento',
    description: 'Accede a análisis detallados de tu progreso académico.',
  },
  advanced_filters: {
    title: 'Filtros avanzados',
    description: 'Filtra tareas por prioridad, materia y orden personalizado.',
  },
  export: {
    title: 'Exportar datos',
    description: 'Descarga tus notas, tareas y sesiones en CSV.',
  },
  pomodoro_link: {
    title: 'Pomodoro vinculado',
    description: 'Vincula sesiones Pomodoro a tareas específicas para trazabilidad.',
  },
};

export function canAccess(plan: Plan, feature: PremiumFeature): boolean {
  if (plan === 'premium') return true;
  return !PREMIUM_FEATURES.has(feature);
}

export function isWithinLimit(
  plan: Plan,
  resource: LimitedResource,
  currentCount: number,
): boolean {
  const limit = PLAN_LIMITS[resource][plan];
  return currentCount < limit;
}

export function getLimitMessage(resource: LimitedResource): string {
  const limit = PLAN_LIMITS[resource].free;
  if (resource === 'courses') {
    return `Límite de ${limit} materias en el plan gratuito. Mejorá a Premium para crear más.`;
  }
  return `Límite de ${limit} tareas activas en el plan gratuito. Mejorá a Premium para crear más.`;
}
