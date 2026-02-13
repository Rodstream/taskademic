import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { PlanProvider } from '@/context/PlanContext';
import { Sidebar } from '@/components/Sidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Taskademic',
  description: 'Plataforma de gestión académica para estudiantes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <PlanProvider>
            <ThemeProvider>
              <div className="flex min-h-screen">
                {/* Sidebar a la izquierda */}
                <Sidebar />
                {/* Contenido principal */}
                <main className="flex-1 bg-[var(--background)] text-[var(--foreground)]">
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </main>
              </div>
            </ThemeProvider>
          </PlanProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
