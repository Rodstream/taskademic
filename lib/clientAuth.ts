import { useAuth } from '@/context/AuthContext';

export function useAuthHeaders() {
  const { token } = useAuth();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  return headers;
}

// versión no-hook (por si la necesitás fuera de React):
export function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem('taskademic_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}
