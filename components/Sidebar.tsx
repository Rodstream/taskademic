'use client';

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
  FaEnvelope
} from 'react-icons/fa';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

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
           <Link href="/tasks">
             <span className="icon"><FaClipboardList /></span>
             <span>Tareas</span>
           </Link>
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
        </ul>
      </nav>
    </div>
  );
}
