'use client';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import Link from 'next/link';
import {
  FaBars,
  FaHome,
  FaInfoCircle,
  FaClipboardList,
  FaEnvelope,
  FaChartBar,
  FaClock,
  FaUser,
  FaSignOutAlt,
} from 'react-icons/fa';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth(); // ← se usa user para decidir si mostrar el logout

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0.65rem 1rem',
    lineHeight: 1.2,
    width: '100%',
  };

  const iconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
  };

  return (
    <div className={`sidebar-wrapper ${collapsed ? 'hidden' : ''}`}>
      <nav className="sidebar">
        <div className="sidebar-header">
          <button
            className="toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <FaBars />
          </button>
        </div>

        <ul>
          <li>
            <Link href="/" style={itemStyle} aria-label="Inicio">
              <span className="icon" style={iconStyle}><FaHome /></span>
              {!collapsed && <span>Inicio</span>}
            </Link>
          </li>

          <li>
            <Link href="/profile" style={itemStyle} aria-label="Perfil">
              <span className="icon" style={iconStyle}><FaUser /></span>
              {!collapsed && <span>Perfil</span>}
            </Link>
          </li>

          <li>
            <Link href="/performance" style={itemStyle} aria-label="Rendimiento">
              <span className="icon" style={iconStyle}><FaChartBar /></span>
              {!collapsed && <span>Rendimiento</span>}
            </Link>
          </li>

          <li>
            <Link href="/tasks" style={itemStyle} aria-label="Tareas">
              <span className="icon" style={iconStyle}><FaClipboardList /></span>
              {!collapsed && <span>Tareas</span>}
            </Link>
          </li>

          <li>
            <Link href="/pomodoro" style={itemStyle} aria-label="Pomodoro">
              <span className="icon" style={iconStyle}><FaClock /></span>
              {!collapsed && <span>Pomodoro</span>}
            </Link>
          </li>

          <li>
            <Link href="/contact" style={itemStyle} aria-label="Contacto">
              <span className="icon" style={iconStyle}><FaEnvelope /></span>
              {!collapsed && <span>Contacto</span>}
            </Link>
          </li>

          <li>
            <Link href="/about" style={itemStyle} aria-label="About">
              <span className="icon" style={iconStyle}><FaInfoCircle /></span>
              {!collapsed && <span>About</span>}
            </Link>
          </li>

          {/* Cerrar sesión solo si hay usuario autenticado */}
          {user && (
            <li>
              <Link
                href="#"
                style={itemStyle}
                aria-label="Cerrar sesión"
                onClick={(e) => {
                  e.preventDefault();
                  logout();
                }}
              >
                <span className="icon" style={iconStyle}><FaSignOutAlt /></span>
                {!collapsed && <span>Cerrar sesión</span>}
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
