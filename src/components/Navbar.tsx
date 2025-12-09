'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';

const links = [
  { href: '/', label: 'Inicio', requiresAuth: false },
  { href: '/tasks', label: 'Tareas', requiresAuth: true },
  // Más adelante se pueden agregar:
  // { href: '/pomodoro', label: 'Pomodoro', requiresAuth: true },
  // { href: '/performance', label: 'Rendimiento', requiresAuth: true },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className="w-full border-b bg-white">
      <nav className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo / nombre */}
        <Link href="/" className="font-bold text-lg">
          Taskademic
        </Link>

        {/* Links de navegación */}
        <div className="flex items-center gap-4">
          {links
            .filter((link) => !link.requiresAuth || user)
            .map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm px-3 py-1 rounded-md border border-transparent hover:bg-gray-100 ${
                  pathname === link.href ? 'bg-gray-100' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
        </div>

        {/* Zona derecha: login / registro o email + logout */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-gray-600 hidden sm:inline">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1 border rounded-md hover:bg-gray-100"
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs px-3 py-1 border rounded-md hover:bg-gray-100"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="text-xs px-3 py-1 border rounded-md hover:bg-gray-100"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
