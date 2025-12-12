// src/app/grades/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { supabaseClient } from '@/lib/supabaseClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
    // verde
    return 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/40';
  }
  if (grade >= 6) {
    // amarillo
    return 'bg-[var(--warn)]/15 text-[var(--warn)] border-[var(--warn)]/40';
  }
  // rojo
  return 'bg-[var(--danger)]/15 text-[var(--danger)] border-[var(--danger)]/40';
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

  // Form
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [examType, setExamType] = useState('');
  const [examDate, setExamDate] = useState('');

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

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    if (!selectedCourseId) {
      setError('Seleccione una materia en el panel de la izquierda.');
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
      console.error(insertError);
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

    // limpiar campos, mantener materia seleccionada
    setGradeValue('');
    setExamType('');
    setExamDate('');
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
      console.error(deleteError);
      setError('No se pudo eliminar la nota.');
      return;
    }

    setGrades((prev) => prev.filter((g) => g.id !== idToDelete));
  };

  // Agrupar notas por materia
  const groupedGrades = useMemo(() => {
    const map = new Map<string, GradeWithCourse[]>();
    for (const g of grades) {
      const list = map.get(g.course_id) ?? [];
      list.push(g);
      map.set(g.course_id, list);
    }
    return map;
  }, [grades]);

  if (loading || (!user && !loading)) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Notas de exámenes</h1>
        <p className="text-sm text-muted max-w-xl">
          Registre las notas de los exámenes por materia. Más adelante estos
          datos se podrán usar en el panel de rendimiento para analizar su
          desempeño a lo largo de la cursada.
        </p>
      </header>

      {error && (
        <p className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Dos cuadros: Materias + Formulario */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel izquierdo: Materias */}
        <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-soft mb-1">Materias</h2>
            <p className="text-sm text-muted">
              Seleccione la materia para la que desea registrar una nota de
              examen.
            </p>

            {!hasCourses ? (
              <p className="text-sm text-muted mt-2">
                Todavía no hay materias cargadas. Puede crearlas desde{' '}
                <Link
                  href="/courses"
                  className="text-[var(--accent)] underline underline-offset-2"
                >
                  la sección Materias
                </Link>
                .
              </p>
            ) : (
              <div className="mt-3 space-y-1 max-h-72 overflow-y-auto pr-1">
                {courses.map((c) => {
                  const active = c.id === selectedCourseId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCourseId(c.id)}
                      className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                        active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40 font-semibold'
                          : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-white/5'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        {/* Panel derecho: formulario */}
        <article className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)]">
          <h2 className="text-sm font-semibold text-soft mb-3">
            Nota de examen por materia
          </h2>

          {!hasCourses ? (
            <p className="text-sm text-muted">
              Una vez que tenga materias creadas, podrá registrar aquí las notas
              de exámenes (parciales, recuperatorios, finales, etc.).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Materia seleccionada */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-soft">
                  Materia seleccionada
                </label>
                <div className="px-3 py-2 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] text-sm">
                  {selectedCourse
                    ? selectedCourse.name
                    : 'Seleccione una materia en el panel de la izquierda.'}
                </div>
                <p className="text-[11px] text-muted">
                  La nota se guardará asociada a esta materia.
                </p>
              </div>

              {/* Tipo de evaluación */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-soft">Tipo de evaluación</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="px-2 py-1 rounded-md text-sm"
                >
                  <option value="">Seleccione una opción</option>
                  {EXAM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted">
                  Ejemplo: Primer parcial, Recuperatorio, Examen final, etc.
                </p>
              </div>

              {/* Nota */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-soft">
                  Nota obtenida (0 a 10)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={gradeValue}
                  onChange={(e) => setGradeValue(e.target.value)}
                  className="px-2 py-1 rounded-md text-sm"
                  placeholder="Ej: 8.50"
                />
                <p className="text-[11px] text-muted">
                  Puede usar punto o coma para decimales.
                </p>
              </div>

              {/* Fecha del examen */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-soft">
                  Fecha del examen (opcional)
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="px-2 py-1 rounded-md text-sm"
                />
                <p className="text-[11px] text-muted">
                  Si no la completa, se usará solo la fecha de registro.
                </p>
              </div>

              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={formLoading || !selectedCourse}
                  className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--foreground)] text-sm font-semibold disabled:opacity-60"
                >
                  {formLoading ? 'Guardando...' : 'Guardar nota'}
                </button>
              </div>
            </form>
          )}
        </article>
      </section>

      {/* Listado de notas */}
      <section className="border border-[var(--card-border)] rounded-lg p-4 bg-[var(--card-bg)] mb-6">
        <h2 className="text-sm font-semibold text-soft mb-3">
          Notas registradas
        </h2>

        {loadingData ? (
          <p className="text-sm text-muted">Cargando notas...</p>
        ) : grades.length === 0 ? (
          <p className="text-sm text-muted">
            Todavía no hay notas registradas. Use el formulario de arriba para
            cargar la primera.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(groupedGrades.entries()).map(([courseIdKey, list]) => {
              const courseName =
                list[0]?.courseName ??
                courses.find((c) => c.id === courseIdKey)?.name ??
                'Materia';

              const avg =
                list.reduce((acc, g) => acc + g.grade, 0) / list.length;

              return (
                <article
                  key={courseIdKey}
                  className="border border-[var(--card-border)] rounded-md p-3 bg-[var(--card-bg)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">{courseName}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted">
                        Promedio
                      </span>
                      <span
                        className={
                          'px-2 py-1 rounded-full border text-xs font-semibold ' +
                          gradeBadgeClasses(avg)
                        }
                      >
                        {avg.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <ul className="flex flex-col gap-2 text-sm">
                    {list.map((g) => {
                      const dateLabel = g.exam_date
                        ? new Date(g.exam_date).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : 'Sin fecha';

                      return (
                        <li
                          key={g.id}
                          className="flex items-center justify-between border border-[var(--card-border)] rounded-md px-3 py-2 bg-[var(--card-bg)]"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <span
                                className={
                                  'px-2 py-1 rounded-full border text-sm font-semibold ' +
                                  gradeBadgeClasses(g.grade)
                                }
                              >
                                {g.grade.toFixed(2)}
                              </span>
                              <div className="flex flex-col">
                                {g.exam_type && (
                                  <span className="text-xs text-soft">
                                    {g.exam_type}
                                  </span>
                                )}
                                <span className="text-[11px] text-muted">
                                  {gradeStatusLabel(g.grade)}
                                </span>
                              </div>
                            </div>
                            <span className="text-[11px] text-muted">
                              Fecha: {dateLabel}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAskDelete(g.id)}
                            disabled={deleteLoadingId === g.id}
                            className="text-[11px] px-2 py-1 rounded-md border border-[var(--card-border)] hover:bg-white/10 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar nota"
        description="¿Seguro que desea eliminar esta nota de examen?"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        loading={deleteLoadingId !== null}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </main>
  );
}
