'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FaEnvelope } from 'react-icons/fa';

import {
  FaHome,
  FaClipboardList,
  FaClock,
  FaChartBar,
  FaCalendarAlt,
  FaBook,
  FaUser,
  FaMoon,
  FaSignOutAlt,
  FaInfoCircle,
  FaListUl,
  FaQuestionCircle,
  FaClipboardCheck,
} from 'react-icons/fa';

const mainLinks = [
  { href: '/', label: 'Inicio', icon: <FaHome />, requiresAuth: false },
  { href: '/courses', label: 'Materias', icon: <FaBook />, requiresAuth: true },
  { href: '/tasks', label: 'Tareas', icon: <FaClipboardList />, requiresAuth: true },
  { href: '/grades', label: 'Notas', requiresAuth: true, icon: <FaClipboardCheck /> },
  { href: '/performance', label: 'Rendimiento', icon: <FaChartBar />, requiresAuth: true },
  { href: '/pomodoro', label: 'Pomodoro', icon: <FaClock />, requiresAuth: true },
  { href: '/calendar', label: 'Calendario', icon: <FaCalendarAlt />, requiresAuth: true },
  { href: '/profile', label: 'Perfil', icon: <FaUser />, requiresAuth: true },
];

const publicSections = [
  {
    href: '/#acerca-de',
    label: 'Que permite hacer',
    icon: <FaListUl />,
  },
  {
    href: '/#que-permite',
    label: 'Acerca de',
    icon: <FaInfoCircle />,
  },
  {
    href: '/#contacto',
    label: 'Contacto',
    icon: <FaEnvelope />,
  },
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

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    await supabaseClient.auth.signOut();
    setLoggingOut(false);
    setLogoutOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <aside
        className={`sticky top-0 ${widthClass} h-screen shrink-0 border-r border-[var(--card-border)] bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-between px-3 py-4 transition-all duration-300`}
      >
        {/* Parte superior */}
        <div>
          {/* Botón colapsar */}
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="mb-4 px-2 py-1 border border-[var(--card-border)] rounded-md text-xs hover:bg-white/5 w-full"
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? '≫' : '≪'}
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="block mb-6 flex items-center gap-3 justify-center md:justify-start"
            title={collapsed ? 'Taskademic' : undefined}
          >
            {collapsed ? (
              <Image
                src="/taskademic-logo.svg"
                alt="Taskademic logo"
                width={32}
                height={32}
                priority
              />
            ) : (
              <>
                <Image
                  src="/taskademic-logo.svg"
                  alt="Taskademic logo"
                  width={28}
                  height={28}
                  priority
                />
                <span className="text-lg font-bold">Taskademic</span>
              </>
            )}
          </Link>

          {/* Navegación principal */}
          <nav className="flex flex-col gap-1">
            {mainLinks
              .filter((l) => !l.requiresAuth || user)
              .map((link) => {
                const active = pathname === link.href;

                const baseClasses =
                  'px-3 py-2 rounded-md text-sm border flex items-center gap-3 transition-colors';

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
                    title={collapsed ? link.label : undefined}
                  >
                    {link.icon}
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
          </nav>

          {/* Secciones de landing (solo sin sesión) */}
          {!user && (
            <div className="mt-4 pt-3 border-t border-[var(--card-border)]">
              {!collapsed && (
                <p className="text-[10px] uppercase tracking-wide mb-2 text-left opacity-60">
                  Taskademic
                </p>
              )}
              <nav className="flex flex-col gap-1 text-sm">
                {publicSections.map((section) => (
                  <Link
                    key={section.href}
                    href={section.href}
                    className="px-3 py-2 rounded-md border border-transparent hover:bg-white/5 flex items-center gap-3 justify-center md:justify-start"
                    title={collapsed ? section.label : undefined}
                  >
                    {section.icon}
                    {!collapsed && <span>{section.label}</span>}
                  </Link>
                ))}
              </nav>
            </div>
          )}

        </div>

        {/* Parte inferior */}
        <div className="flex flex-col gap-3 text-sm">
          {/* Modo oscuro */}
          <button
            onClick={toggleTheme}
            className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 flex items-center justify-between"
            title={collapsed ? 'Modo oscuro' : undefined}
            aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            aria-pressed={theme === 'dark'}
          >
            <div className="flex items-center gap-3">
              <FaMoon />
              {!collapsed && <span>Modo oscuro</span>}
            </div>
            {!collapsed && <span>{theme === 'dark' ? 'ON' : 'OFF'}</span>}
          </button>

          {/* Sesión */}
          {user ? (
            <div className="border-t border-[var(--card-border)] pt-3">
              {!collapsed && (
                <p className="text-xs opacity-80 mb-2 break-all">
                  {user.email}
                </p>
              )}

              <button
                onClick={() => setLogoutOpen(true)}
                className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 flex items-center gap-3 text-xs"
                title={collapsed ? 'Cerrar sesión' : undefined}
              >
                <FaSignOutAlt />
                {!collapsed && <span>Cerrar sesión</span>}
              </button>
            </div>
          ) : (
            <div className="border-t border-[var(--card-border)] pt-3 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 text-center text-xs"
                title={collapsed ? 'Iniciar sesión' : undefined}
              >
                {!collapsed ? 'Iniciar sesión' : 'Log'}
              </Link>
              <Link
                href="/register"
                className="w-full px-3 py-2 border border-[var(--card-border)] rounded-md hover:bg-white/5 text-center text-xs"
                title={collapsed ? 'Registrarse' : undefined}
              >
                {!collapsed ? 'Registrarse' : 'Reg'}
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
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
}
