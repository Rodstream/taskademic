import './globals.css';
import { ReactNode } from 'react';
import Sidebar from '../../components/Sidebar';

export const metadata = {
  title: 'Taskademic',
  description: 'Menú lateral minimalista con verde claro',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
