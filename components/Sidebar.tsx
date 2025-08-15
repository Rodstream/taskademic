'use client';
import { useAuth } from '@/context/AuthContext';

import { FaChartBar } from 'react-icons/fa'; // ícono sugerido
import { FaClock } from 'react-icons/fa';
import { FaUser } from 'react-icons/fa';
import { useState } from 'react';
import Link from 'next/link';
import {
  FaBars,
  FaHome,
  FaInfoCircle,
  FaClipboardList,
  FaEnvelope,
  FaSignOutAlt,   // 👈 importamos el ícono de logout
} from 'react-icons/fa';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout } = useAuth(); // 👈 usamos el logout del contexto

  return (
    <div className={`sidebar-wrapper ${collapsed ? 'hidden' : ''}`}>
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2></h2>
          <button
            className="toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <FaBars />
          </button>
        </div>

        <ul>
          <li>        
           <Link href="/">
             <span className="icon"><FaHome /></span>
              <span>Inicio</span>
           </Link>
          </li>
          <li>
            <Link href="/profile">
              <span className="icon"><FaUser /></span>
              <span>Perfil</span>
            </Link>
          </li>
          <li>
            <Link href="/performance">
              <span className="icon"><FaChartBar /></span>
              <span>Rendimiento</span>
            </Link>
          </li>
          <li>       
           <Link href="/tasks">…</Link>
             <span className="icon"><FaClipboardList /></span>
             <span>Tareas</span>
          </li>
          <li>
            <Link href="/pomodoro">
              <span className="icon"><FaClock /></span>
              <span>Pomodoro</span>
            </Link>
          </li>
          <li>
           <Link href="/contact">
              <span className="icon"><FaEnvelope /></span>
              <span>Contacto</span>
           </Link>
          </li>
          <li>        
           <Link href="/about">
             <span className="icon"><FaInfoCircle /></span>
             <span>About</span>
            </Link>
          </li>

          {/* 🔽 Botón de logout */}
          <li>
            <button
              onClick={logout}
              className="logout-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '0.5rem 1rem',
                width: '100%',
                textAlign: 'left'
              }}
            >
              <span className="icon"><FaSignOutAlt /></span>
              <span>Cerrar sesión</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
