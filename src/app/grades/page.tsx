// src/app/grades/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  FaGraduationCap,
  FaPlus,
  FaTrash,
  FaBook,
  FaCalendarAlt,
  FaTrophy,
  FaChartLine,
  FaHistory,
  FaLayerGroup,
} from 'react-icons/fa';

type Course = {
  id: string;
  name: string;
};

type CourseGradeRow = {
  id: string;
  course_id: string;
  grade: number;
  exam_type: string | null;
  exam_date: string | null;
  created_at: string;
};

type GradeWithCourse = CourseGradeRow & {
  courseName: string;
};

const EXAM_TYPES = [
  'Primer parcial',
  'Segundo parcial',
  'Recuperatorio',
  'Globalizador',
  'Examen final',
];

// Clases para el color de la nota individual
function gradeBadgeClasses(grade: number): string {
  if (grade >= 8) {
    return 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/40';
  }
  if (grade >= 6) {
    return 'bg-[var(--warn)]/15 text-[var(--warn)] border-[var(--warn)]/40';
  }
  return 'bg-[var(--danger)]/15 text-[var(--danger)] border-[var(--danger)]/40';
}

// Color sólido para el número grande
function gradeColor(grade: number): string {
  if (grade >= 8) return 'text-[var(--success)]';
  if (grade >= 6) return 'text-[var(--warn)]';
  return 'text-[var(--danger)]';
}

// Texto para la etiqueta de estado
function gradeStatusLabel(grade: number): string {
  if (grade >= 10) return 'Excelente';
  if (grade >= 8) return 'Muy bien';
  if (grade >= 6) return 'Aprobado';
  if (grade >= 4) return 'En riesgo';
  return 'Desaprobado';
}

export default function GradesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<GradeWithCourse[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);

  // Form
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [examType, setExamType] = useState('');
  const [examDate, setExamDate] = useState('');

  // Filtro de materia
  const [filterCourseId, setFilterCourseId] = useState<string>('all');

  // Vista: 'grouped' (por materia) o 'history' (cronológico)
  const [viewMode, setViewMode] = useState<'grouped' | 'history'>('grouped');

  // Confirmación de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gradeToDelete, setGradeToDelete] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // Proteger ruta
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar materias + notas
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingData(true);
      setError(null);

      // MATERIAS
      const { data: coursesData, error: coursesError } = await supabaseClient
        .from('courses')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (coursesError) {
        console.warn('Error cargando materias:', coursesError);
        setError('No se pudieron cargar las materias.');
        setLoadingData(false);
        return;
      }

      const coursesList = (coursesData ?? []) as Course[];
      setCourses(coursesList);

      if (coursesList.length > 0 && !selectedCourseId) {
        setSelectedCourseId(coursesList[0].id);
      }

      // NOTAS POR MATERIA
      const { data: gradesData, error: gradesError } = await supabaseClient
        .from('course_grades')
        .select('id, course_id, grade, exam_type, exam_date, created_at')
        .eq('user_id', user.id)
        .order('exam_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (gradesError) {
        console.warn('Error cargando notas de exámenes:', gradesError);
        setError('No se pudieron cargar las notas de exámenes.');
        setLoadingData(false);
        return;
      }

      const rawGrades = (gradesData ?? []) as CourseGradeRow[];
      const coursesMap = new Map(coursesList.map((c) => [c.id, c.name]));

      const withNames: GradeWithCourse[] = rawGrades.map((g) => ({
        ...g,
        courseName: coursesMap.get(g.course_id) ?? 'Materia desconocida',
      }));

      setGrades(withNames);
      setLoadingData(false);
    };

    fetchData();
  }, [user, selectedCourseId]);

  const hasCourses = courses.length > 0;

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!selectedCourseId) {
      setError('Seleccione una materia.');
      return;
    }

    if (!examType) {
      setError('Seleccione el tipo de evaluación.');
      return;
    }

    const numericGrade = Number(gradeValue.replace(',', '.'));
    if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 10) {
      setError('Ingrese una nota válida entre 0 y 10.');
      return;
    }

    setFormLoading(true);

    const { data, error: insertError } = await supabaseClient
      .from('course_grades')
      .insert({
        user_id: user.id,
        course_id: selectedCourseId,
        grade: numericGrade,
        exam_type: examType,
        exam_date: examDate || null,
      })
      .select('id, course_id, grade, exam_type, exam_date, created_at')
      .single();

    setFormLoading(false);

    if (insertError) {
      setError('No se pudo guardar la nota.');
      return;
    }

    if (!data) return;

    const inserted = data as CourseGradeRow;
    const courseName =
      courses.find((c) => c.id === inserted.course_id)?.name ?? 'Materia';

    setGrades((prev) => [
      {
        ...inserted,
        courseName,
      },
      ...prev,
    ]);

    // limpiar campos y cerrar modal
    setGradeValue('');
    setExamType('');
    setExamDate('');
    setShowModal(false);
  };

  // --- Manejo de confirmación de eliminación ---
  const handleAskDelete = (id: string) => {
    setGradeToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setGradeToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!user || !gradeToDelete) return;

    const idToDelete = gradeToDelete;

    setDeleteLoadingId(idToDelete);
    setError(null);

    const { error: deleteError } = await supabaseClient
      .from('course_grades')
      .delete()
      .eq('id', idToDelete)
      .eq('user_id', user.id);

    setDeleteLoadingId(null);
    setDeleteDialogOpen(false);
    setGradeToDelete(null);

    if (deleteError) {
      setError('No se pudo eliminar la nota.');
      return;
    }

    setGrades((prev) => prev.filter((g) => g.id !== idToDelete));
  };

  // Agrupar notas por materia
  const groupedGrades = useMemo(() => {
    const map = new Map<string, GradeWithCourse[]>();
    for (const g of grades) {
      if (filterCourseId !== 'all' && g.course_id !== filterCourseId) continue;
      const list = map.get(g.course_id) ?? [];
      list.push(g);
      map.set(g.course_id, list);
    }
    return map;
  }, [grades, filterCourseId]);

  // Estadísticas generales
  const stats = useMemo(() => {
    if (grades.length === 0) return null;
    const total = grades.length;
    const sum = grades.reduce((acc, g) => acc + g.grade, 0);
    const avg = sum / total;
    const approved = grades.filter((g) => g.grade >= 6).length;
    const highest = Math.max(...grades.map((g) => g.grade));
    return { total, avg, approved, highest };
  }, [grades]);

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FaGraduationCap className="text-[var(--accent)]" />
              Notas de exámenes
            </h1>
            <p className="text-sm text-muted mt-1">
              Registra y visualiza tus calificaciones por materia
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={!hasCourses}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FaPlus className="text-xs" />
            Nueva nota
          </button>
        </header>

        {error && (
          <div className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 px-4 py-2 rounded-xl">
            {error}
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <article className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <FaBook className="text-[var(--accent)] text-sm" />
                <span className="text-xs text-muted uppercase tracking-wide">Total</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted">notas registradas</p>
            </article>

            <article className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <FaChartLine className="text-[var(--primary-soft)] text-sm" />
                <span className="text-xs text-muted uppercase tracking-wide">Promedio</span>
              </div>
              <p className={`text-2xl font-bold ${gradeColor(stats.avg)}`}>
                {stats.avg.toFixed(2)}
              </p>
              <p className="text-xs text-muted">{gradeStatusLabel(stats.avg)}</p>
            </article>

            <article className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <FaGraduationCap className="text-[var(--success)] text-sm" />
                <span className="text-xs text-muted uppercase tracking-wide">Aprobadas</span>
              </div>
              <p className="text-2xl font-bold text-[var(--success)]">{stats.approved}</p>
              <p className="text-xs text-muted">de {stats.total} exámenes</p>
            </article>

            <article className="border border-[var(--card-border)] rounded-2xl p-4 bg-[var(--card-bg)]">
              <div className="flex items-center gap-2 mb-2">
                <FaTrophy className="text-[var(--warn)] text-sm" />
                <span className="text-xs text-muted uppercase tracking-wide">Mejor nota</span>
              </div>
              <p className={`text-2xl font-bold ${gradeColor(stats.highest)}`}>
                {stats.highest.toFixed(2)}
              </p>
              <p className="text-xs text-muted">{gradeStatusLabel(stats.highest)}</p>
            </article>
          </section>
        )}

        {/* Sin materias */}
        {!hasCourses && (
          <div className="text-center py-12 border border-dashed border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)]/50">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
              <FaBook className="text-2xl text-[var(--accent)]" />
            </div>
            <p className="text-soft mb-2">No tienes materias cargadas</p>
            <p className="text-xs text-muted mb-4">
              Primero debes crear materias para poder registrar notas
            </p>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--foreground)] text-sm font-medium"
            >
              Ir a Materias
            </Link>
          </div>
        )}

        {/* Filtro y listado */}
        {hasCourses && (
          <>
            {/* Controles: Vista + Filtro */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold mr-2">Notas registradas</h2>
                {/* Toggle de vista */}
                <div className="flex rounded-xl border border-[var(--card-border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'grouped'
                        ? 'bg-[var(--accent)] text-[var(--foreground)]'
                        : 'bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]'
                    }`}
                  >
                    <FaLayerGroup className="text-[10px]" />
                    Por materia
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('history')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'history'
                        ? 'bg-[var(--accent)] text-[var(--foreground)]'
                        : 'bg-[var(--card-bg)] text-muted hover:text-[var(--foreground)]'
                    }`}
                  >
                    <FaHistory className="text-[10px]" />
                    Historial
                  </button>
                </div>
              </div>
              {/* Filtro por materia */}
              <select
                value={filterCourseId}
                onChange={(e) => setFilterCourseId(e.target.value)}
                className="text-sm border border-[var(--card-border)] rounded-xl px-3 py-2 bg-[var(--card-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              >
                <option value="all">Todas las materias</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Listado de notas */}
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : grades.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)]/50">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                  <FaGraduationCap className="text-2xl text-[var(--accent)]" />
                </div>
                <p className="text-soft mb-2">No hay notas registradas</p>
                <p className="text-xs text-muted">
                  Usa el botón &quot;Nueva nota&quot; para cargar tu primera calificación
                </p>
              </div>
            ) : viewMode === 'grouped' ? (
              // Vista agrupada por materia
              groupedGrades.size === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  No hay notas para la materia seleccionada.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {Array.from(groupedGrades.entries()).map(([courseIdKey, list]) => {
                    const courseName = list[0]?.courseName ?? 'Materia';
                    const avg = list.reduce((acc, g) => acc + g.grade, 0) / list.length;

                    return (
                      <article
                        key={courseIdKey}
                        className="border border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)] overflow-hidden"
                      >
                        {/* Header de materia */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                              <FaBook className="text-[var(--accent)]" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{courseName}</h3>
                              <p className="text-xs text-muted">{list.length} {list.length === 1 ? 'nota' : 'notas'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted">Promedio</p>
                            <p className={`text-xl font-bold ${gradeColor(avg)}`}>
                              {avg.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {/* Lista de notas */}
                        <div className="divide-y divide-[var(--card-border)]">
                          {list.map((g) => {
                            const dateLabel = g.exam_date
                              ? new Date(g.exam_date + 'T00:00:00').toLocaleDateString('es-AR', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : null;

                            return (
                              <div
                                key={g.id}
                                className="flex items-center justify-between p-4 hover:bg-[var(--card-bg)]/50 transition-colors group"
                              >
                                <div className="flex items-center gap-4">
                                  <span
                                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold border ${gradeBadgeClasses(g.grade)}`}
                                  >
                                    {g.grade.toFixed(1)}
                                  </span>
                                  <div>
                                    <p className="font-medium">
                                      {g.exam_type || 'Examen'}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-muted">
                                      <span className={gradeColor(g.grade)}>
                                        {gradeStatusLabel(g.grade)}
                                      </span>
                                      {dateLabel && (
                                        <>
                                          <span>•</span>
                                          <span className="flex items-center gap-1">
                                            <FaCalendarAlt className="text-[10px]" />
                                            {dateLabel}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAskDelete(g.id)}
                                  disabled={deleteLoadingId === g.id}
                                  className="p-2 rounded-lg text-muted hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                  title="Eliminar"
                                >
                                  <FaTrash className="text-sm" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )
            ) : (
              // Vista historial cronológico
              (() => {
                // Filtrar por materia si es necesario
                const filteredGrades = filterCourseId === 'all'
                  ? grades
                  : grades.filter((g) => g.course_id === filterCourseId);

                if (filteredGrades.length === 0) {
                  return (
                    <p className="text-sm text-muted text-center py-8">
                      No hay notas para la materia seleccionada.
                    </p>
                  );
                }

                return (
                  <div className="border border-[var(--card-border)] rounded-2xl bg-[var(--card-bg)] overflow-hidden">
                    <div className="divide-y divide-[var(--card-border)]">
                      {filteredGrades.map((g) => {
                        const dateLabel = g.exam_date
                          ? new Date(g.exam_date + 'T00:00:00').toLocaleDateString('es-AR', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Sin fecha';

                        return (
                          <div
                            key={g.id}
                            className="flex items-center justify-between p-4 hover:bg-[var(--card-bg)]/50 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              <span
                                className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold border ${gradeBadgeClasses(g.grade)}`}
                              >
                                {g.grade.toFixed(1)}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{g.courseName}</p>
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--card-border)] text-muted">
                                    {g.exam_type || 'Examen'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                                  <span className={gradeColor(g.grade)}>
                                    {gradeStatusLabel(g.grade)}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <FaCalendarAlt className="text-[10px]" />
                                    {dateLabel}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAskDelete(g.id)}
                              disabled={deleteLoadingId === g.id}
                              className="p-2 rounded-lg text-muted hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                              title="Eliminar"
                            >
                              <FaTrash className="text-sm" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </>
        )}
      </main>

      {/* Modal Nueva Nota */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md bg-[var(--background)] border border-[var(--card-border)] rounded-2xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--card-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
                  <FaGraduationCap className="text-[var(--foreground)]" />
                </div>
                <div>
                  <h2 className="font-semibold">Nueva nota</h2>
                  <p className="text-xs text-muted">Registra una calificación</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-muted hover:text-[var(--foreground)] hover:bg-[var(--card-bg)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              {/* Materia */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-soft font-medium">Materia</span>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  required
                >
                  <option value="">Seleccionar materia</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Tipo de evaluación */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-soft font-medium">Tipo de evaluación</span>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  required
                >
                  <option value="">Seleccionar tipo</option>
                  {EXAM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Nota */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-soft font-medium">Nota (0-10)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={gradeValue}
                    onChange={(e) => setGradeValue(e.target.value)}
                    className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    placeholder="8.50"
                    required
                  />
                </label>

                {/* Fecha */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-soft font-medium">Fecha (opcional)</span>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="border border-[var(--card-border)] rounded-xl px-3 py-2.5 bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                  />
                </label>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--card-border)] text-[var(--foreground)] font-medium hover:bg-[var(--card-bg)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--foreground)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {formLoading ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar nota"
        description="¿Seguro que deseas eliminar esta nota? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleteLoadingId !== null}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
