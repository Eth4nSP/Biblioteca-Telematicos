import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import '../../styles/Docente/SolicitudesColeccionesDocente.css';

export default function SolicitudesColeccionesDocente() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [filtro, setFiltro] = useState('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const usuario = authData?.user;

      if (!usuario) {
        throw new Error('Debes iniciar sesión.');
      }

      const { data: perfil, error: perfilError } =
        await supabase
          .from('perfiles')
          .select('id, rol')
          .eq('id', usuario.id)
          .single();

      if (perfilError) throw perfilError;

      if (
        (perfil?.rol || '').trim().toLowerCase() !== 'docente'
      ) {
        throw new Error(
          'Esta sección es exclusiva para docentes.'
        );
      }

      // Obtener solicitudes junto con los datos de sus colecciones.
      const {
        data: solicitudesData,
        error: solicitudesError,
      } = await supabase
        .from('solicitudes_coleccion')
        .select(`
          id,
          coleccion_id,
          estudiante_id,
          estado,
          fecha_solicitud,
          fecha_respuesta,
          coleccion:colecciones (
            id,
            nombre,
            descripcion,
            docente_id
          )
        `)
        .order('fecha_solicitud', { ascending: false });

      if (solicitudesError) throw solicitudesError;

      // Mostrar únicamente las solicitudes de las colecciones
      // pertenecientes al docente autenticado.
      const solicitudesBase = (solicitudesData || []).filter(
        (solicitud) =>
          solicitud.coleccion &&
          solicitud.coleccion.docente_id === usuario.id
      );

      // Obtener nombre y correo mediante la función RPC segura.
      const {
        data: datosEstudiantes,
        error: datosEstudiantesError,
      } = await supabase.rpc('datos_estudiantes_solicitudes');

      if (datosEstudiantesError) {
        throw datosEstudiantesError;
      }

      const estudiantesPorSolicitud = Object.fromEntries(
        (datosEstudiantes || []).map((estudiante) => [
          estudiante.solicitud_id,
          estudiante,
        ])
      );

      const resultado = solicitudesBase.map((solicitud) => ({
        ...solicitud,
        estudiante:
          estudiantesPorSolicitud[solicitud.id] || null,
      }));

      setSolicitudes(resultado);
    } catch (err) {
      console.error(
        'Error al cargar solicitudes de colecciones:',
        err
      );

      setError(
        err.message ||
          'No se pudieron cargar las solicitudes.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const responderSolicitud = async (solicitud, estado) => {
    const accion =
      estado === 'aprobada' ? 'aprobar' : 'rechazar';

    const nombre =
      solicitud.estudiante?.nombre_completo ||
      'este estudiante';

    const confirmado = window.confirm(
      `¿Deseas ${accion} la solicitud de ${nombre} para "${solicitud.coleccion?.nombre || 'esta colección'}"?`
    );

    if (!confirmado) return;

    setError('');
    setMensaje('');
    setProcesandoId(solicitud.id);

    try {
      const { error: respuestaError } = await supabase.rpc(
        'responder_solicitud_coleccion',
        {
          p_solicitud_id: solicitud.id,
          p_estado: estado,
        }
      );

      if (respuestaError) throw respuestaError;

      setMensaje(
        estado === 'aprobada'
          ? `Solicitud de ${nombre} aprobada. Se ha procesado su acceso a la colección.`
          : `Solicitud de ${nombre} rechazada.`
      );

      await cargarSolicitudes();
    } catch (err) {
      console.error(
        'Error al responder la solicitud:',
        err
      );

      setError(
        err.message ||
          'No se pudo procesar la solicitud.'
      );
    } finally {
      setProcesandoId(null);
    }
  };

  const solicitudesFiltradas = solicitudes.filter(
    (solicitud) => {
      const coincideEstado =
        filtro === 'todas' || solicitud.estado === filtro;

      const texto = busqueda.trim().toLowerCase();

      const coincideTexto =
        !texto ||
        (solicitud.estudiante?.nombre_completo || '')
          .toLowerCase()
          .includes(texto) ||
        (solicitud.estudiante?.correo || '')
          .toLowerCase()
          .includes(texto) ||
        (solicitud.estudiante_id || '')
          .toLowerCase()
          .includes(texto) ||
        (solicitud.coleccion?.nombre || '')
          .toLowerCase()
          .includes(texto);

      return coincideEstado && coincideTexto;
    }
  );

  const pendientes = solicitudes.filter(
    (solicitud) => solicitud.estado === 'pendiente'
  ).length;

  const formatoFecha = (fecha) => {
    if (!fecha) return '—';

    const fechaObj = new Date(fecha);

    if (Number.isNaN(fechaObj.getTime())) return '—';

    return new Intl.DateTimeFormat('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fechaObj);
  };

  if (cargando) {
    return (
      <main className="scd-container">
        <p>Cargando solicitudes...</p>
      </main>
    );
  }

  return (
    <main className="scd-container">
      <header className="scd-header">
        <div>
          <p className="scd-eyebrow">PANEL DOCENTE</p>
          <h1>Solicitudes de colecciones</h1>
          <p>
            Consulta los datos de los estudiantes y administra
            sus solicitudes de acceso.
          </p>
        </div>

        <button
          type="button"
          className="scd-button scd-button-light"
          onClick={cargarSolicitudes}
          disabled={procesandoId !== null}
        >
          Actualizar
        </button>
      </header>

      {error && (
        <div className="scd-alert scd-error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="scd-alert scd-success" role="status">
          {mensaje}
        </div>
      )}

      <section className="scd-summary">
        <div className="scd-summary-card">
          <span>Pendientes de respuesta</span>
          <strong>{pendientes}</strong>
        </div>

        <div className="scd-summary-card">
          <span>Total de solicitudes</span>
          <strong>{solicitudes.length}</strong>
        </div>
      </section>

      <section className="scd-panel">
        <div className="scd-toolbar">
          <input
            type="search"
            className="scd-search"
            placeholder="Buscar estudiante, correo, ID o colección..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <select
            className="scd-filter"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="todas">Todas</option>
          </select>
        </div>

        {solicitudesFiltradas.length === 0 ? (
          <div className="scd-empty">
            <span>📬</span>
            <h2>No hay solicitudes para mostrar</h2>
            <p>
              Prueba con otro filtro o revisa más tarde.
            </p>
          </div>
        ) : (
          <div className="scd-list">
            {solicitudesFiltradas.map((solicitud) => {
              const nombre =
                solicitud.estudiante?.nombre_completo ||
                'Nombre no disponible';

              const correo =
                solicitud.estudiante?.correo ||
                'Correo no disponible';

              return (
                <article
                  className="scd-request"
                  key={solicitud.id}
                >
                  <div className="scd-request-main">
                    <div className="scd-avatar" aria-hidden="true">
                      {nombre.charAt(0).toUpperCase()}
                    </div>

                    <div className="scd-request-info">
                      <h2>{nombre}</h2>

                      <p>
                        <strong>Correo:</strong> {correo}
                      </p>

                      <p>
                        <strong>Colección solicitada:</strong>{' '}
                        {solicitud.coleccion?.nombre ||
                          'Colección no disponible'}
                      </p>

                      <span className="scd-date">
                        Solicitud:{' '}
                        {formatoFecha(solicitud.fecha_solicitud)}
                      </span>

                      {solicitud.fecha_respuesta && (
                        <span className="scd-date">
                          Respuesta:{' '}
                          {formatoFecha(solicitud.fecha_respuesta)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="scd-request-actions">
                    <span
                      className={`scd-status scd-status-${solicitud.estado}`}
                    >
                      {solicitud.estado.charAt(0).toUpperCase() +
                        solicitud.estado.slice(1)}
                    </span>

                    {solicitud.estado === 'pendiente' && (
                      <div className="scd-buttons">
                        <button
                          type="button"
                          className="scd-button scd-button-approve"
                          disabled={procesandoId !== null}
                          onClick={() =>
                            responderSolicitud(
                              solicitud,
                              'aprobada'
                            )
                          }
                        >
                          {procesandoId === solicitud.id
                            ? 'Procesando...'
                            : 'Aprobar'}
                        </button>

                        <button
                          type="button"
                          className="scd-button scd-button-reject"
                          disabled={procesandoId !== null}
                          onClick={() =>
                            responderSolicitud(
                              solicitud,
                              'rechazada'
                            )
                          }
                        >
                          {procesandoId === solicitud.id
                            ? 'Procesando...'
                            : 'Rechazar'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
