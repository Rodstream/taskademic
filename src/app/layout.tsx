import './globals.css';
import { ReactNode } from 'react';
import Sidebar from '../../components/Sidebar';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Taskademic',
  description: 'Menú lateral minimalista con verde claro',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <div className="layout">
            <Sidebar />
            <main className="content">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
