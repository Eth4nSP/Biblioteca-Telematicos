
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import '../../styles/Docente/GestionColeccionesDocente.css';

export default function GestionColeccionesDocente({ usuario, perfil }) {
  const [usuarioId, setUsuarioId] = useState(null);
  const [colecciones, setColecciones] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [coleccionId, setColeccionId] = useState('');

  const [librosColeccion, setLibrosColeccion] = useState([]);
  const [estudiantesColeccion, setEstudiantesColeccion] = useState([]);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [modalidad, setModalidad] = useState('privada');

  // Datos del formulario de edición.
  const edicionRef = useRef(null);
  const nombreEdicionRef = useRef(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editModalidad, setEditModalidad] = useState('privada');
  const [enfocarEdicion, setEnfocarEdicion] = useState(false);

  const [recursoId, setRecursoId] = useState('');
  const [estudianteId, setEstudianteId] = useState('');
  const [busquedaEstudiante, setBusquedaEstudiante] = useState('');
  const [busquedaLibro, setBusquedaLibro] = useState('');

  const [solicitudesLectura, setSolicitudesLectura] = useState([]);
  const [fechaInicioLectura, setFechaInicioLectura] = useState('');
  const [fechaFinLectura, setFechaFinLectura] = useState('');
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const coleccionSeleccionada = useMemo(
    () => colecciones.find((c) => c.id === coleccionId) || null,
    [colecciones, coleccionId]
  );

  const estudiantesFiltrados = useMemo(() => {
    const texto = busquedaEstudiante.trim().toLowerCase();

    return estudiantes.filter((estudiante) =>
      (estudiante.nombre_completo || '').toLowerCase().includes(texto)
    );
  }, [estudiantes, busquedaEstudiante]);

  const recursosFiltrados = useMemo(() => {
    const texto = busquedaLibro.trim().toLowerCase();

    return recursos.filter((recurso) => {
      const coincide =
        (recurso.titulo || '').toLowerCase().includes(texto) ||
        (recurso.autor || '').toLowerCase().includes(texto);

      return coincide &&
        !librosColeccion.some((libro) => libro.recurso_id === recurso.id);
    });
  }, [recursos, librosColeccion, busquedaLibro]);

  const solicitudesColeccionSeleccionada = useMemo(
    () => solicitudesLectura.filter(
      (solicitud) => solicitud.coleccion_id === coleccionId
    ),
    [solicitudesLectura, coleccionId]
  );

  const mostrarError = (err, operacion) => {
    console.error(`${operacion}:`, err);
    setError(`${operacion}: ${err?.message || 'Ocurrió un error inesperado.'}`);
    setMensaje('');
  };

  const obtenerFechaHoraLocal = (fecha = new Date()) => {
    const fechaLocal = new Date(
      fecha.getTime() - fecha.getTimezoneOffset() * 60000
    );
    return fechaLocal.toISOString().slice(0, 16);
  };

  // Mantener el formulario de edición sincronizado con la colección activa.
  useEffect(() => {
    if (!coleccionSeleccionada) {
      setEditNombre('');
      setEditDescripcion('');
      setEditModalidad('privada');
      return;
    }

    setEditNombre(coleccionSeleccionada.nombre || '');
    setEditDescripcion(coleccionSeleccionada.descripcion || '');
    setEditModalidad(coleccionSeleccionada.modalidad_acceso || 'privada');
  }, [coleccionSeleccionada]);

  // Ejecutar el desplazamiento después de que React renderice el formulario.
  useEffect(() => {
    if (!enfocarEdicion || !coleccionSeleccionada) return;

    const primerFrame = requestAnimationFrame(() => {
      edicionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      // El segundo frame ayuda a que el foco se aplique tras el render.
      requestAnimationFrame(() => {
        nombreEdicionRef.current?.focus({ preventScroll: true });
        setEnfocarEdicion(false);
      });
    });

    return () => cancelAnimationFrame(primerFrame);
  }, [enfocarEdicion, coleccionSeleccionada]);

  const cargarDetalle = useCallback(async (id) => {
    if (!id) {
      setLibrosColeccion([]);
      setEstudiantesColeccion([]);
      return;
    }

    const [
      { data: libros, error: errorLibros },
      { data: miembros, error: errorMiembros },
    ] = await Promise.all([
      supabase
        .from('coleccion_libros')
        .select(`
          id,
          coleccion_id,
          recurso_id,
          fecha_agregado,
          recurso:recursos_bibliograficos (id, titulo, autor)
        `)
        .eq('coleccion_id', id)
        .order('fecha_agregado', { ascending: false }),

      supabase
        .from('coleccion_estudiantes')
        .select('id, coleccion_id, estudiante_id, fecha_union, activo')
        .eq('coleccion_id', id)
        .order('fecha_union', { ascending: false }),
    ]);

    if (errorLibros) {
      mostrarError(errorLibros, 'No se pudieron cargar los libros');
      return;
    }

    if (errorMiembros) {
      mostrarError(errorMiembros, 'No se pudieron cargar los estudiantes');
      return;
    }

    setLibrosColeccion(libros || []);
    setEstudiantesColeccion(miembros || []);
  }, []);

  const cargarSolicitudesLectura = useCallback(async (idColeccion = null) => {
    setCargandoSolicitudes(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authData?.user) throw new Error('No hay una sesión iniciada.');

      let consulta = supabase
        .from('solicitudes_lectura_coleccion')
        .select(`
          id, coleccion_id, docente_id, fecha_inicio, fecha_fin,
          estado, fecha_solicitud, fecha_respuesta, observaciones
        `)
        .eq('docente_id', authData.user.id)
        .order('fecha_solicitud', { ascending: false });

      if (idColeccion) {
        consulta = consulta.eq('coleccion_id', idColeccion);
      }

      const { data, error: consultaError } = await consulta;
      if (consultaError) throw consultaError;

      setSolicitudesLectura((actuales) => {
        if (!idColeccion) return data || [];

        const otras = actuales.filter(
          (s) => s.coleccion_id !== idColeccion
        );

        return [...otras, ...(data || [])].sort(
          (a, b) =>
            new Date(b.fecha_solicitud).getTime() -
            new Date(a.fecha_solicitud).getTime()
        );
      });
    } catch (err) {
      mostrarError(err, 'No se pudieron cargar las solicitudes de lectura');
    } finally {
      setCargandoSolicitudes(false);
    }
  }, []);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const usuarioActual = authData?.user;
      if (!usuarioActual) throw new Error('No hay una sesión iniciada.');

      setUsuarioId(usuarioActual.id);

      const { data: perfilActual, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, rol, nombre_completo')
        .eq('id', usuarioActual.id)
        .single();

      if (perfilError) throw perfilError;

      if ((perfilActual?.rol || '').trim().toLowerCase() !== 'docente') {
        throw new Error('Esta sección está disponible únicamente para docentes.');
      }

      const [
        { data: coleccionesData, error: coleccionesError },
        { data: recursosData, error: recursosError },
        { data: estudiantesData, error: estudiantesError },
      ] = await Promise.all([
        supabase
          .from('colecciones')
          .select(`
            id, nombre, descripcion, docente_id, modalidad_acceso, activa,
            fecha_creacion, codigo_acceso, lectura_habilitada,
            fecha_inicio_lectura, fecha_fin_lectura
          `)
          .eq('docente_id', usuarioActual.id)
          .order('fecha_creacion', { ascending: false }),

        supabase
          .from('recursos_bibliograficos')
          .select('id, titulo, autor, creado_por')
          .order('titulo', { ascending: true }),

        supabase.rpc('listar_estudiantes_biblioteca'),
      ]);

      if (coleccionesError) throw coleccionesError;
      if (recursosError) throw recursosError;

      if (estudiantesError) {
        console.error('Error al consultar estudiantes:', estudiantesError);
        setEstudiantes([]);
        setError(
          'No se pudo cargar la lista de estudiantes. Verifica la función ' +
          'listar_estudiantes_biblioteca() y los permisos del docente.'
        );
      } else {
        setEstudiantes(estudiantesData || []);
      }

      setColecciones(coleccionesData || []);
      setRecursos(recursosData || []);

      await cargarSolicitudesLectura();

      const seleccionActual = coleccionId;
      const existeSeleccion = (coleccionesData || []).some(
        (c) => c.id === seleccionActual
      );

      if (seleccionActual && existeSeleccion) {
        await cargarDetalle(seleccionActual);
      } else if ((coleccionesData || []).length > 0) {
        const primera = coleccionesData[0].id;
        setColeccionId(primera);
        await cargarDetalle(primera);
      } else {
        setColeccionId('');
        setLibrosColeccion([]);
        setEstudiantesColeccion([]);
      }
    } catch (err) {
      mostrarError(err, 'No se pudieron cargar los datos');
    } finally {
      setCargando(false);
    }
  }, [coleccionId, cargarDetalle, cargarSolicitudesLectura]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Seleccionar una colección y desplazarse a su edición.
  const seleccionarColeccion = async (coleccion) => {
    setError('');
    setMensaje('');
    setFechaInicioLectura('');
    setFechaFinLectura('');
    setColeccionId(coleccion.id);
    setEnfocarEdicion(true);

    await Promise.all([
      cargarDetalle(coleccion.id),
      cargarSolicitudesLectura(coleccion.id),
    ]);
  };

  // Guardar los cambios del formulario de edición.
  const guardarEdicionColeccion = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!coleccionSeleccionada) {
      setError('Selecciona una colección para editar.');
      return;
    }

    if (!editNombre.trim()) {
      setError('El nombre de la colección es obligatorio.');
      nombreEdicionRef.current?.focus();
      return;
    }

    setGuardando(true);

    try {
      const cambios = {
        nombre: editNombre.trim(),
        descripcion: editDescripcion.trim() || null,
        modalidad_acceso: editModalidad,
      };

      const { data, error: updateError } = await supabase
        .from('colecciones')
        .update(cambios)
        .eq('id', coleccionSeleccionada.id)
        .eq('docente_id', usuarioId)
        .select(`
          id, nombre, descripcion, docente_id, modalidad_acceso, activa,
          fecha_creacion, codigo_acceso, lectura_habilitada,
          fecha_inicio_lectura, fecha_fin_lectura
        `)
        .single();

      if (updateError) throw updateError;

      setColecciones((actuales) =>
        actuales.map((c) => c.id === data.id ? { ...c, ...data } : c)
      );

      setMensaje('Colección actualizada correctamente.');
    } catch (err) {
      mostrarError(err, 'No se pudo actualizar la colección');
    } finally {
      setGuardando(false);
    }
  };

  const crearColeccion = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!nombre.trim()) {
      setError('Escribe un nombre para la colección.');
      return;
    }

    if (!usuarioId) {
      setError('No se pudo identificar al docente.');
      return;
    }

    setGuardando(true);

    try {
      const { data, error: insertError } = await supabase
        .from('colecciones')
        .insert({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          docente_id: usuarioId,
          modalidad_acceso: modalidad,
          activa: true,
        })
        .select(`
          id, nombre, descripcion, docente_id, modalidad_acceso, activa,
          fecha_creacion, codigo_acceso, lectura_habilitada,
          fecha_inicio_lectura, fecha_fin_lectura
        `)
        .single();

      if (insertError) throw insertError;

      setNombre('');
      setDescripcion('');
      setModalidad('privada');

      await cargarDatos();
      setColeccionId(data.id);
      await cargarDetalle(data.id);
      setEnfocarEdicion(true);

      setMensaje(
        `Colección creada. Código de acceso: ${data.codigo_acceso || 'No generado'}.`
      );
    } catch (err) {
      mostrarError(err, 'No se pudo crear la colección');
    } finally {
      setGuardando(false);
    }
  };

  const agregarLibro = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!coleccionId || !recursoId) {
      setError('Selecciona una colección y un libro.');
      return;
    }

    setGuardando(true);

    try {
      const { error: insertError } = await supabase
        .from('coleccion_libros')
        .insert({ coleccion_id: coleccionId, recurso_id: recursoId });

      if (insertError) throw insertError;

      setRecursoId('');
      await cargarDetalle(coleccionId);
      setMensaje('Libro agregado a la colección.');
    } catch (err) {
      mostrarError(err, 'No se pudo agregar el libro');
    } finally {
      setGuardando(false);
    }
  };

  const quitarLibro = async (idRelacion) => {
    if (!window.confirm('¿Quieres quitar este libro de la colección?')) return;

    setError('');
    setMensaje('');
    setGuardando(true);

    try {
      const { error: deleteError } = await supabase
        .from('coleccion_libros')
        .delete()
        .eq('id', idRelacion);

      if (deleteError) throw deleteError;

      await cargarDetalle(coleccionId);
      setMensaje('Libro quitado de la colección.');
    } catch (err) {
      mostrarError(err, 'No se pudo quitar el libro');
    } finally {
      setGuardando(false);
    }
  };

  const agregarEstudiante = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!coleccionId || !estudianteId) {
      setError('Selecciona un estudiante.');
      return;
    }

    const existente = estudiantesColeccion.find(
      (m) => m.estudiante_id === estudianteId
    );

    setGuardando(true);

    try {
      if (existente) {
        const { error: updateError } = await supabase
          .from('coleccion_estudiantes')
          .update({ activo: true })
          .eq('id', existente.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('coleccion_estudiantes')
          .insert({
            coleccion_id: coleccionId,
            estudiante_id: estudianteId,
            activo: true,
          });

        if (insertError) throw insertError;
      }

      setEstudianteId('');
      await cargarDetalle(coleccionId);
      setMensaje('Estudiante agregado a la colección.');
    } catch (err) {
      mostrarError(err, 'No se pudo agregar al estudiante');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoEstudiante = async (miembro) => {
    const nuevoEstado = !miembro.activo;
    setError('');
    setMensaje('');
    setGuardando(true);

    try {
      const { error: updateError } = await supabase
        .from('coleccion_estudiantes')
        .update({ activo: nuevoEstado })
        .eq('id', miembro.id);

      if (updateError) throw updateError;

      await cargarDetalle(coleccionId);
      setMensaje(
        nuevoEstado
          ? 'Se restauró el acceso del estudiante.'
          : 'Se retiró el acceso del estudiante.'
      );
    } catch (err) {
      mostrarError(err, 'No se pudo actualizar el acceso');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarColeccion = async () => {
    if (!coleccionSeleccionada) return;

    const confirmar = window.confirm(
      `¿Eliminar la colección "${coleccionSeleccionada.nombre}"? ` +
      'Esta acción puede eliminar también sus relaciones con libros y estudiantes.'
    );

    if (!confirmar) return;

    setError('');
    setMensaje('');
    setGuardando(true);

    try {
      const { error: deleteError } = await supabase
        .from('colecciones')
        .delete()
        .eq('id', coleccionSeleccionada.id);

      if (deleteError) throw deleteError;

      setColeccionId('');
      setLibrosColeccion([]);
      setEstudiantesColeccion([]);
      setSolicitudesLectura([]);

      await cargarDatos();
      setMensaje('Colección eliminada.');
    } catch (err) {
      mostrarError(err, 'No se pudo eliminar la colección');
    } finally {
      setGuardando(false);
    }
  };

  const copiarCodigo = async () => {
    const codigo = coleccionSeleccionada?.codigo_acceso;

    if (!codigo) {
      setError('Esta colección no tiene un código de acceso generado.');
      return;
    }

    try {
      await navigator.clipboard.writeText(codigo);
      setMensaje('Código copiado al portapapeles.');
      setError('');
    } catch (err) {
      mostrarError(err, 'No se pudo copiar el código');
    }
  };

  const solicitarHabilitacionLectura = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!coleccionSeleccionada) {
      setError('Selecciona una colección.');
      return;
    }

    if (!usuarioId) {
      setError('No se pudo identificar al docente.');
      return;
    }

    if (!fechaInicioLectura || !fechaFinLectura) {
      setError('Selecciona la fecha y hora de inicio y finalización.');
      return;
    }

    const inicio = new Date(fechaInicioLectura);
    const fin = new Date(fechaFinLectura);
    const ahora = new Date();

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      setError('Las fechas seleccionadas no son válidas.');
      return;
    }

    if (inicio <= ahora) {
      setError('El inicio de la lectura debe ser una fecha y hora futuras.');
      return;
    }

    if (fin <= inicio) {
      setError('La finalización debe ser posterior al inicio.');
      return;
    }

    const yaPendiente = solicitudesLectura.some(
      (s) => s.coleccion_id === coleccionSeleccionada.id &&
        s.estado === 'pendiente'
    );

    if (yaPendiente) {
      setError(
        'Ya tienes una solicitud pendiente para esta colección. ' +
        'Espera la respuesta del bibliotecario.'
      );
      return;
    }

    setGuardando(true);

    try {
      const { error: insertError } = await supabase
        .from('solicitudes_lectura_coleccion')
        .insert({
          coleccion_id: coleccionSeleccionada.id,
          docente_id: usuarioId,
          fecha_inicio: inicio.toISOString(),
          fecha_fin: fin.toISOString(),
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Ya existe una solicitud pendiente para esta colección.');
        }

        if (insertError.code === '42501') {
          throw new Error(
            'No tienes permiso para enviar esta solicitud. Verifica las políticas RLS.'
          );
        }

        throw insertError;
      }

      setFechaInicioLectura('');
      setFechaFinLectura('');
      await cargarSolicitudesLectura(coleccionSeleccionada.id);
      setMensaje(
        'Solicitud enviada correctamente. El bibliotecario deberá revisarla.'
      );
    } catch (err) {
      mostrarError(err, 'No se pudo enviar la solicitud');
    } finally {
      setGuardando(false);
    }
  };

  const nombreEstudiante = (id) => {
    const estudiante = estudiantes.find((e) => e.id === id);
    return estudiante?.nombre_completo || `Estudiante ${String(id).slice(0, 8)}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'No disponible';

    const fechaValida = new Date(fecha);
    if (Number.isNaN(fechaValida.getTime())) return 'Fecha no válida';

    return fechaValida.toLocaleString();
  };

  const textoEstadoSolicitud = (estado) => {
    switch (estado) {
      case 'pendiente': return 'Pendiente de revisión';
      case 'aprobada': return 'Aprobada';
      case 'rechazada': return 'Rechazada';
      default: return estado || 'Estado desconocido';
    }
  };

  if (cargando) {
    return (
      <div className="gcd-container">
        <p>Cargando colecciones...</p>
      </div>
    );
  }

  return (
    <div className="gcd-container">
      <header className="gcd-header">
        <div>
          <h2>Mis colecciones</h2>
          <p>Organiza tus libros y administra el acceso de tus estudiantes.</p>
        </div>

        <button
          type="button"
          className="gcd-btn gcd-btn-secondary"
          onClick={cargarDatos}
          disabled={guardando}
        >
          Actualizar
        </button>
      </header>

      {error && (
        <div className="gcd-alert gcd-alert-error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="gcd-alert gcd-alert-success" role="status">
          {mensaje}
        </div>
      )}

      <section className="gcd-panel">
        <h3>Crear colección</h3>

        <form className="gcd-form" onSubmit={crearColeccion}>
          <label>
            Nombre de la colección
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Matemática de secundaria"
              maxLength={150}
              required
            />
          </label>

          <label>
            Descripción
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el propósito de esta colección"
              rows={3}
            />
          </label>

          <label>
            Modalidad de acceso
            <select
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
            >
              <option value="privada">Privada: solo estudiantes agregados</option>
              <option value="codigo">Mediante código de acceso</option>
              <option value="inscripcion">Solicitud de inscripción</option>
            </select>
          </label>

          <button
            type="submit"
            className="gcd-btn gcd-btn-primary"
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Crear colección'}
          </button>
        </form>
      </section>

      <section className="gcd-panel">
        <h3>Tus colecciones</h3>

        {colecciones.length === 0 ? (
          <p>Aún no has creado ninguna colección.</p>
        ) : (
          <div className="gcd-collection-list">
            {colecciones.map((coleccion) => (
              <button
                type="button"
                key={coleccion.id}
                className={`gcd-collection-item ${
                  coleccionId === coleccion.id ? 'selected' : ''
                }`}
                aria-pressed={coleccionId === coleccion.id}
                onClick={() => seleccionarColeccion(coleccion)}
              >
                <span className="gcd-collection-name">{coleccion.nombre}</span>
                <span className="gcd-collection-meta">
                  {coleccion.modalidad_acceso} · {coleccion.activa ? 'Activa' : 'Inactiva'}
                </span>
                <span className="gcd-collection-action">
                  {coleccionId === coleccion.id ? 'Seleccionada' : 'Editar colección →'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {coleccionSeleccionada && (
        <>
          {/* NUEVO: FORMULARIO DE EDICIÓN */}
          <section
            className="gcd-panel gcd-edit-panel"
            ref={edicionRef}
            tabIndex={-1}
            aria-labelledby="gcd-edit-title"
          >
            <div className="gcd-edit-heading">
              <span className="gcd-edit-eyebrow">GESTIÓN DE COLECCIÓN</span>
              <h3 id="gcd-edit-title">Editar colección</h3>
              <p>
                Modifica los datos de <strong>{coleccionSeleccionada.nombre}</strong>.
                Los cambios se guardarán en tu biblioteca.
              </p>
            </div>

            <form className="gcd-form" onSubmit={guardarEdicionColeccion}>
              <label>
                Nombre de la colección
                <input
                  ref={nombreEdicionRef}
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Nombre de la colección"
                  maxLength={150}
                  required
                  disabled={guardando}
                />
              </label>

              <label>
                Modalidad de acceso
                <select
                  value={editModalidad}
                  onChange={(e) => setEditModalidad(e.target.value)}
                  disabled={guardando}
                >
                  <option value="privada">Privada: solo estudiantes agregados</option>
                  <option value="codigo">Mediante código de acceso</option>
                  <option value="inscripcion">Solicitud de inscripción</option>
                </select>
              </label>

              <label className="gcd-edit-description">
                Descripción
                <textarea
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                  placeholder="Describe el propósito de esta colección"
                  rows={4}
                  maxLength={2000}
                  disabled={guardando}
                />
              </label>

              <div className="gcd-edit-footer">
                <span className="gcd-edit-hint">
                  ID: {coleccionSeleccionada.id}
                </span>

                <button
                  type="submit"
                  className="gcd-btn gcd-btn-primary"
                  disabled={guardando || !editNombre.trim()}
                >
                  {guardando ? 'Guardando cambios...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>

          <section className="gcd-panel gcd-code-panel">
            <div>
              <h3>Código de acceso</h3>
              <p>Comparte este código según la modalidad de acceso de la colección.</p>
              <div className="gcd-code-value">
                {coleccionSeleccionada.codigo_acceso || 'Sin código'}
              </div>
            </div>

            <button
              type="button"
              className="gcd-btn gcd-btn-secondary"
              onClick={copiarCodigo}
              disabled={!coleccionSeleccionada.codigo_acceso}
            >
              Copiar código
            </button>
          </section>

          <section className="gcd-panel">
            <h3>Solicitar habilitación de lectura</h3>
            <p>
              Solicita al bibliotecario que habilite la lectura de los libros
              de esta colección durante un período determinado.
            </p>

            <form className="gcd-form" onSubmit={solicitarHabilitacionLectura}>
              <label>
                Colección seleccionada
                <input type="text" value={coleccionSeleccionada.nombre} readOnly />
              </label>

              <label>
                Fecha y hora de inicio
                <input
                  type="datetime-local"
                  value={fechaInicioLectura}
                  onChange={(e) => {
                    setFechaInicioLectura(e.target.value);
                    if (
                      fechaFinLectura &&
                      e.target.value &&
                      fechaFinLectura <= e.target.value
                    ) setFechaFinLectura('');
                  }}
                  min={obtenerFechaHoraLocal()}
                  required
                />
              </label>

              <label>
                Fecha y hora de finalización
                <input
                  type="datetime-local"
                  value={fechaFinLectura}
                  onChange={(e) => setFechaFinLectura(e.target.value)}
                  min={fechaInicioLectura || obtenerFechaHoraLocal()}
                  required
                />
              </label>

              <button
                type="submit"
                className="gcd-btn gcd-btn-primary"
                disabled={guardando || cargandoSolicitudes}
              >
                {guardando ? 'Enviando solicitud...' : 'Enviar solicitud'}
              </button>
            </form>

            <hr />
            <h4>Mis solicitudes de esta colección</h4>

            {cargandoSolicitudes ? (
              <p>Consultando solicitudes...</p>
            ) : solicitudesColeccionSeleccionada.length === 0 ? (
              <p>Aún no has enviado solicitudes para esta colección.</p>
            ) : (
              <div className="gcd-list">
                {solicitudesColeccionSeleccionada.map((solicitud) => (
                  <div className="gcd-list-item" key={solicitud.id}>
                    <div>
                      <strong>Estado: {textoEstadoSolicitud(solicitud.estado)}</strong>
                      <p>Fecha de solicitud: {formatearFecha(solicitud.fecha_solicitud)}</p>
                      <p>Inicio solicitado: {formatearFecha(solicitud.fecha_inicio)}</p>
                      <p>Finalización solicitada: {formatearFecha(solicitud.fecha_fin)}</p>
                      {solicitud.fecha_respuesta && (
                        <p>Fecha de respuesta: {formatearFecha(solicitud.fecha_respuesta)}</p>
                      )}
                      {solicitud.observaciones && (
                        <p>Observaciones: {solicitud.observaciones}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="gcd-panel">
            <h3>Agregar libro</h3>

            <form className="gcd-form" onSubmit={agregarLibro}>
              <label>
                Buscar libro
                <input
                  type="search"
                  value={busquedaLibro}
                  onChange={(e) => setBusquedaLibro(e.target.value)}
                  placeholder="Buscar por título o autor"
                />
              </label>

              <label>
                Seleccionar recurso
                <select
                  value={recursoId}
                  onChange={(e) => setRecursoId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un libro</option>
                  {recursosFiltrados.map((recurso) => (
                    <option key={recurso.id} value={recurso.id}>
                      {recurso.titulo}{recurso.autor ? ` — ${recurso.autor}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="gcd-btn gcd-btn-primary"
                disabled={guardando || !recursoId}
              >
                Agregar libro
              </button>
            </form>

            <h4>Libros incluidos ({librosColeccion.length})</h4>

            {librosColeccion.length === 0 ? (
              <p>Esta colección todavía no tiene libros.</p>
            ) : (
              <div className="gcd-list">
                {librosColeccion.map((libro) => (
                  <div className="gcd-list-item" key={libro.id}>
                    <div>
                      <strong>{libro.recurso?.titulo || 'Recurso sin título'}</strong>
                      <p>{libro.recurso?.autor || 'Autor no especificado'}</p>
                    </div>
                    <button
                      type="button"
                      className="gcd-btn gcd-btn-danger"
                      disabled={guardando}
                      onClick={() => quitarLibro(libro.id)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="gcd-panel">
            <h3>Administrar estudiantes</h3>

            <form className="gcd-form" onSubmit={agregarEstudiante}>
              <label>
                Buscar estudiante por nombre
                <input
                  type="search"
                  value={busquedaEstudiante}
                  onChange={(e) => setBusquedaEstudiante(e.target.value)}
                  placeholder="Escribe el nombre del estudiante"
                />
              </label>

              <label>
                Estudiantes disponibles
                <select
                  value={estudianteId}
                  onChange={(e) => setEstudianteId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un estudiante</option>
                  {estudiantesFiltrados
                    .filter((estudiante) => {
                      const miembro = estudiantesColeccion.find(
                        (m) => m.estudiante_id === estudiante.id
                      );
                      return !miembro || !miembro.activo;
                    })
                    .map((estudiante) => (
                      <option key={estudiante.id} value={estudiante.id}>
                        {estudiante.nombre_completo || 'Sin nombre'}
                      </option>
                    ))}
                </select>
              </label>

              <button
                type="submit"
                className="gcd-btn gcd-btn-primary"
                disabled={guardando || !estudianteId}
              >
                Agregar estudiante
              </button>
            </form>

            {estudiantes.length === 0 && (
              <p className="gcd-muted">
                No se encontraron estudiantes. Comprueba la función
                listar_estudiantes_biblioteca() y el rol de tu cuenta.
              </p>
            )}

            <h4>Estudiantes de la colección ({estudiantesColeccion.length})</h4>

            {estudiantesColeccion.length === 0 ? (
              <p>No hay estudiantes registrados en esta colección.</p>
            ) : (
              <div className="gcd-list">
                {estudiantesColeccion.map((miembro) => (
                  <div className="gcd-list-item" key={miembro.id}>
                    <div>
                      <strong>{nombreEstudiante(miembro.estudiante_id)}</strong>
                      <p>Estado: {miembro.activo ? 'Acceso activo' : 'Retirado'}</p>
                    </div>
                    <button
                      type="button"
                      className={
                        miembro.activo
                          ? 'gcd-btn gcd-btn-danger'
                          : 'gcd-btn gcd-btn-secondary'
                      }
                      disabled={guardando}
                      onClick={() => cambiarEstadoEstudiante(miembro)}
                    >
                      {miembro.activo ? 'Retirar acceso' : 'Restaurar acceso'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="gcd-panel gcd-danger-panel">
            <h3>Eliminar colección</h3>
            <p>Elimina esta colección cuando ya no necesites utilizarla.</p>
            <button
              type="button"
              className="gcd-btn gcd-btn-danger"
              disabled={guardando}
              onClick={eliminarColeccion}
            >
              Eliminar colección
            </button>
          </section>
        </>
      )}
    </div>
  );
}
