// Funciones de validación de seguridad

// Constantes de validación
export const VALIDATION = {
  TASK_TITLE_MAX: 200,
  TASK_DESCRIPTION_MAX: 2000,
  COURSE_NAME_MAX: 100,
  FULL_NAME_MAX: 100,
  PASSWORD_MIN: 8,
} as const;

// Dominios permitidos para avatares
const ALLOWED_AVATAR_DOMAINS = [
  'imgur.com',
  'i.imgur.com',
  'gravatar.com',
  'avatars.githubusercontent.com',
  'lh3.googleusercontent.com',
  'cloudinary.com',
  'res.cloudinary.com',
];

/**
 * Valida el título de una tarea
 */
export function validateTaskTitle(title: string): { valid: boolean; error?: string } {
  const trimmed = title.trim();
  if (!trimmed) {
    return { valid: false, error: 'El título es requerido' };
  }
  if (trimmed.length > VALIDATION.TASK_TITLE_MAX) {
    return { valid: false, error: `El título no puede exceder ${VALIDATION.TASK_TITLE_MAX} caracteres` };
  }
  return { valid: true };
}

/**
 * Valida la descripción de una tarea
 */
export function validateTaskDescription(description: string): { valid: boolean; error?: string } {
  if (description.length > VALIDATION.TASK_DESCRIPTION_MAX) {
    return { valid: false, error: `La descripción no puede exceder ${VALIDATION.TASK_DESCRIPTION_MAX} caracteres` };
  }
  return { valid: true };
}

/**
 * Valida el formato de fecha (YYYY-MM-DD)
 */
export function validateDateFormat(date: string): { valid: boolean; error?: string } {
  if (!date) return { valid: true }; // Fecha opcional

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return { valid: false, error: 'Formato de fecha inválido' };
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return { valid: false, error: 'Fecha inválida' };
  }

  return { valid: true };
}

/**
 * Valida el nombre de un curso
 */
export function validateCourseName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'El nombre es requerido' };
  }
  if (trimmed.length > VALIDATION.COURSE_NAME_MAX) {
    return { valid: false, error: `El nombre no puede exceder ${VALIDATION.COURSE_NAME_MAX} caracteres` };
  }
  return { valid: true };
}

/**
 * Valida el formato de color hexadecimal
 */
export function validateColor(color: string): { valid: boolean; error?: string } {
  if (!color) return { valid: true }; // Color opcional

  const colorRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!colorRegex.test(color)) {
    return { valid: false, error: 'Formato de color inválido (use #RRGGBB)' };
  }
  return { valid: true };
}

/**
 * Valida la fortaleza de una contraseña
 */
const COMMON_PASSWORDS = [
  'password', '12345678', '123456789', 'qwerty123', 'abc12345',
  'password1', 'iloveyou', '11111111', 'admin123', 'welcome1',
];

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < VALIDATION.PASSWORD_MIN) {
    errors.push(`Mínimo ${VALIDATION.PASSWORD_MIN} caracteres`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos una letra mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Al menos una letra minúscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Al menos un número');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Al menos un carácter especial (!@#$%...)');
  }
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Esta contraseña es muy común');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calcula el nivel de fortaleza de la contraseña (0-4)
 */
export function getPasswordStrength(password: string): number {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  return Math.min(strength, 4);
}

/**
 * Valida una URL de avatar
 */
export function validateAvatarUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: true }; // URL opcional

  try {
    const parsed = new URL(url);

    // Solo permitir HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'La URL debe usar HTTPS' };
    }

    // Verificar dominio permitido
    const isAllowed = ALLOWED_AVATAR_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return { valid: false, error: 'Dominio no permitido para avatares' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'URL inválida' };
  }
}

/**
 * Valida el nombre completo
 */
export function validateFullName(name: string): { valid: boolean; error?: string } {
  if (!name) return { valid: true }; // Nombre opcional

  if (name.length > VALIDATION.FULL_NAME_MAX) {
    return { valid: false, error: `El nombre no puede exceder ${VALIDATION.FULL_NAME_MAX} caracteres` };
  }
  return { valid: true };
}

/**
 * Sanitiza un string codificando caracteres HTML peligrosos
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Valida la estructura de datos del Pomodoro en localStorage
 */
export function validatePomodoroStorage(data: unknown): {
  valid: boolean;
  data?: {
    focusMinutes: number;
    breakMinutes: number;
    selectedTaskId: string;
  };
} {
  if (!data || typeof data !== 'object') {
    return { valid: false };
  }

  const obj = data as Record<string, unknown>;

  // Validar focusMinutes
  if (typeof obj.focusMinutes !== 'number' || obj.focusMinutes < 1 || obj.focusMinutes > 120) {
    return { valid: false };
  }

  // Validar breakMinutes
  if (typeof obj.breakMinutes !== 'number' || obj.breakMinutes < 1 || obj.breakMinutes > 60) {
    return { valid: false };
  }

  // Validar selectedTaskId
  if (typeof obj.selectedTaskId !== 'string') {
    return { valid: false };
  }

  return {
    valid: true,
    data: {
      focusMinutes: obj.focusMinutes,
      breakMinutes: obj.breakMinutes,
      selectedTaskId: obj.selectedTaskId,
    },
  };
}
