'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const links = [
  { href: '/', label: 'Inicio', requiresAuth: false },
  { href: '/tasks', label: 'Tareas', requiresAuth: true },
  { href: '/pomodoro', label: 'Pomodoro', requiresAuth: true },
  { href: '/performance', label: 'Rendimiento', requiresAuth: true },
  { href: '/calendar', label: 'Calendario', requiresAuth: true },
  { href: '/profile', label: 'Perfil', requiresAuth: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const widthClass = collapsed ? 'w-16' : 'w-60';

  const handleLogoutClick = () => {
    setLogoutOpen(true);
  };

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    await supabaseClient.auth.signOut();
    setLoggingOut(false);
    setLogoutOpen(false);
    router.push('/');
    router.refresh();
  };

  const handleLogoutCancel = () => {
    setLogoutOpen(false);
  };

  return (
    <>
      <aside
        className={`h-screen ${widthClass} border-r border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-between px-3 py-4 transition-all`}
      >
        {/* Parte superior: botón colapsar + logo + navegación */}
        <div>
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="mb-4 px-2 py-1 border border-[var(--card-border)] rounded-md text-xs hover:bg-white/5 w-full"
          >
            {collapsed ? '≫' : '≪'}
          </button>

          <Link href="/" className="block mb-6">
            <span className="text-lg font-bold">
              {collapsed ? 'T' : 'Taskademic'}
            </span>
          </Link>

          <nav className="flex flex-col gap-1">
            {links
              .filter((link) => !link.requiresAuth || user)
              .map((link) => {
                const active = pathname === link.href;

                const baseClasses =
                  'px-3 py-2 rounded-md text-sm border text-left transition-colors';

                const activeClasses =
                  'bg-[var(--accent-soft)] border-[var(--accent)] font-semibold';

                const inactiveClasses =
                  'border-transparent hover:bg-white/5';

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${baseClasses} ${
                      active ? activeClasses : inactiveClasses
                    }`}
                  >
                    {collapsed ? link.label[0] : link.label}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Parte inferior: tema + sesión */}
        <div className="flex flex-col gap-3 text-sm">
          <button
            onClick={toggleTheme}
            className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 flex items-center justify-between"
          >
            <span>{collapsed ? '🌙' : 'Modo oscuro'}</span>
            {!collapsed && <span>{theme === 'dark' ? 'ON' : 'OFF'}</span>}
          </button>

          {user ? (
            <div className="border-t border-[var(--card-border)] pt-3">
              {!collapsed && (
                <p className="text-xs opacity-80 mb-2 break-all">
                  {user.email}
                </p>
              )}
              <button
                onClick={handleLogoutClick}
                className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 text-xs"
              >
                {collapsed ? 'Salir' : 'Cerrar sesión'}
              </button>
            </div>
          ) : (
            <div className="border-t border-[var(--card-border)] pt-3 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 text-center text-xs"
              >
                {collapsed ? 'Log' : 'Iniciar sesión'}
              </Link>
              <Link
                href="/register"
                className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 text-center text-xs"
              >
                {collapsed ? 'Reg' : 'Registrarse'}
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Confirmación de logout */}
      <ConfirmDialog
        open={logoutOpen}
        title="Cerrar sesión"
        description="¿Seguro que desea cerrar la sesión actual?"
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        loading={loggingOut}
        onCancel={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
}
