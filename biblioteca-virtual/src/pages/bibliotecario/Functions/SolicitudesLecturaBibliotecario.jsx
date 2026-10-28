
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient.js';
import '../../../styles/Bibliotecario/SolicitudesLecturaBibliotecario.css';

const RPC_NAME = 'gestionar_solicitudes_lectura_bibliotecario';

const formatearFecha = (valor) => {
  if (!valor) return 'No especificada';

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return 'Fecha no válida';
  }

  return fecha.toLocaleString('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const obtenerEstado = (estado) => {
  const estados = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
  };

  return estados[estado] || estado || 'Desconocido';
};

const obtenerMensajeError = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';

  if (error.code === '42501') {
    return 'No tienes permisos para realizar esta operación.';
  }

  if (error.code === 'PGRST202' || error.code === '42883') {
    return (
      'No se encontró la función RPC de solicitudes de lectura. ' +
      'Debes crearla en Supabase y actualizar el esquema de la API.'
    );
  }

  return error.message || 'Ocurrió un error inesperado.';
};

export default function SolicitudesLecturaBibliotecario() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [observaciones, setObservaciones] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true);
    setError('');
    setMensaje('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const usuario = authData?.user;

      if (!usuario) {
        throw new Error('Debes iniciar sesión para acceder a esta sección.');
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, rol')
        .eq('id', usuario.id)
        .single();

      if (perfilError) throw perfilError;

      if (
        String(perfil?.rol || '').trim().toLowerCase() !== 'bibliotecario'
      ) {
        throw new Error(
          'Esta sección está disponible únicamente para bibliotecarios.'
        );
      }

      const { data, error: rpcError } = await supabase.rpc(RPC_NAME, {
        p_accion: 'listar',
        p_datos: {},
      });

      if (rpcError) throw rpcError;

      // La RPC devuelve un arreglo JSON con las solicitudes y sus datos asociados.
      const resultado = Array.isArray(data)
        ? data
        : Array.isArray(data?.solicitudes)
          ? data.solicitudes
          : [];

      setSolicitudes(resultado);
    } catch (err) {
      console.error('Error al cargar solicitudes de lectura:', err);
      setError(obtenerMensajeError(err));
      setSolicitudes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const solicitudesFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return solicitudes.filter((solicitud) => {
      const coincideEstado =
        filtroEstado === 'todas' || solicitud.estado === filtroEstado;

      const texto = [
        solicitud.coleccion_nombre,
        solicitud.docente_nombre,
        solicitud.docente_email,
        solicitud.observaciones,
        solicitud.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return coincideEstado && (!termino || texto.includes(termino));
    });
  }, [solicitudes, filtroEstado, busqueda]);

  const contadores = useMemo(
    () => ({
      todas: solicitudes.length,
      pendiente: solicitudes.filter((s) => s.estado === 'pendiente').length,
      aprobada: solicitudes.filter((s) => s.estado === 'aprobada').length,
      rechazada: solicitudes.filter((s) => s.estado === 'rechazada').length,
    }),
    [solicitudes]
  );

  const responderSolicitud = async (solicitud, nuevoEstado) => {
    if (!solicitud?.id) {
      setError('No se pudo identificar la solicitud.');
      return;
    }

    if (!['aprobada', 'rechazada'].includes(nuevoEstado)) {
      setError('El estado solicitado no es válido.');
      return;
    }

    if (solicitud.estado !== 'pendiente') {
      setError('Esta solicitud ya fue respondida.');
      return;
    }

    const accionTexto = nuevoEstado === 'aprobada' ? 'aprobar' : 'rechazar';

    const confirmado = window.confirm(
      `¿Confirmas ${accionTexto} la solicitud de lectura de ` +
      `"${solicitud.coleccion_nombre || 'esta colección'}"?`
    );

    if (!confirmado) return;

    setProcesandoId(solicitud.id);
    setError('');
    setMensaje('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData?.user) {
        throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
      }

      const { data, error: rpcError } = await supabase.rpc(RPC_NAME, {
        p_accion: 'responder',
        p_datos: {
          solicitud_id: solicitud.id,
          estado: nuevoEstado,
          observaciones: observaciones[solicitud.id]?.trim() || null,
        },
      });

      if (rpcError) throw rpcError;

      if (data?.success === false) {
        throw new Error(data.message || 'No se pudo procesar la solicitud.');
      }

      setMensaje(
        nuevoEstado === 'aprobada'
          ? 'Solicitud aprobada. La lectura se habilitó para el período autorizado.'
          : 'Solicitud rechazada correctamente.'
      );

      setObservaciones((actuales) => {
        const copia = { ...actuales };
        delete copia[solicitud.id];
        return copia;
      });

      await cargarSolicitudes();
    } catch (err) {
      console.error('Error al responder solicitud:', err);
      setError(obtenerMensajeError(err));
    } finally {
      setProcesandoId(null);
    }
  };

  if (cargando) {
    return (
      <section className="slb-contenedor">
        <div className="slb-cargando">
          <span className="slb-spinner" aria-hidden="true" />
          <p>Cargando solicitudes de lectura...</p>
        </div>
      </section>
    );
  }

  return (
    <main className="slb-contenedor">
      <header className="slb-encabezado">
        <div>
          <h1>Solicitudes de lectura</h1>
          <p>
            Revisa las solicitudes de los docentes y autoriza el acceso a las
            colecciones durante un período determinado.
          </p>
        </div>

        <button
          type="button"
          className="slb-btn slb-btn-secundario"
          onClick={cargarSolicitudes}
          disabled={Boolean(procesandoId)}
        >
          Actualizar
        </button>
      </header>

      {mensaje && (
        <div className="slb-alerta slb-alerta-exito" role="status">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="slb-alerta slb-alerta-error" role="alert">
          {error}
        </div>
      )}

      <section className="slb-estadisticas">
        <button
          type="button"
          className={`slb-estadistica ${
            filtroEstado === 'todas' ? 'seleccionada' : ''
          }`}
          onClick={() => setFiltroEstado('todas')}
        >
          <span>Total de solicitudes</span>
          <strong>{contadores.todas}</strong>
        </button>

        <button
          type="button"
          className={`slb-estadistica ${
            filtroEstado === 'pendiente' ? 'seleccionada' : ''
          }`}
          onClick={() => setFiltroEstado('pendiente')}
        >
          <span>Pendientes</span>
          <strong>{contadores.pendiente}</strong>
        </button>

        <button
          type="button"
          className={`slb-estadistica ${
            filtroEstado === 'aprobada' ? 'seleccionada' : ''
          }`}
          onClick={() => setFiltroEstado('aprobada')}
        >
          <span>Aprobadas</span>
          <strong>{contadores.aprobada}</strong>
        </button>

        <button
          type="button"
          className={`slb-estadistica ${
            filtroEstado === 'rechazada' ? 'seleccionada' : ''
          }`}
          onClick={() => setFiltroEstado('rechazada')}
        >
          <span>Rechazadas</span>
          <strong>{contadores.rechazada}</strong>
        </button>
      </section>

      <section className="slb-filtros">
        <label className="slb-busqueda">
          <span>Buscar solicitud</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre de colección, docente o correo..."
          />
        </label>

        <label>
          <span>Estado</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todas">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </label>
      </section>

      <section className="slb-listado">
        {solicitudesFiltradas.length === 0 ? (
          <div className="slb-vacio">
            <h2>No hay solicitudes para mostrar</h2>
            <p>
              Prueba otro filtro o actualiza la lista para consultar nuevas
              solicitudes.
            </p>
          </div>
        ) : (
          solicitudesFiltradas.map((solicitud) => {
            const procesando = procesandoId === solicitud.id;
            const pendiente = solicitud.estado === 'pendiente';

            return (
              <article className="slb-tarjeta" key={solicitud.id}>
                <div className="slb-tarjeta-encabezado">
                  <div>
                    <h2>
                      {solicitud.coleccion_nombre || 'Colección sin nombre'}
                    </h2>
                    <p>
                      Docente:{' '}
                      <strong>
                        {solicitud.docente_nombre || 'No disponible'}
                      </strong>
                    </p>
                    {solicitud.docente_email && (
                      <p>{solicitud.docente_email}</p>
                    )}
                  </div>

                  <span
                    className={`slb-estado slb-estado-${solicitud.estado}`}
                  >
                    {obtenerEstado(solicitud.estado)}
                  </span>
                </div>

                <div className="slb-periodo">
                  <div>
                    <span>Inicio solicitado</span>
                    <strong>{formatearFecha(solicitud.fecha_inicio)}</strong>
                  </div>
                  <div>
                    <span>Fin solicitado</span>
                    <strong>{formatearFecha(solicitud.fecha_fin)}</strong>
                  </div>
                </div>

                <div className="slb-detalles">
                  <p>
                    <strong>Fecha de solicitud:</strong>{' '}
                    {formatearFecha(solicitud.fecha_solicitud)}
                  </p>

                  {solicitud.fecha_respuesta && (
                    <p>
                      <strong>Fecha de respuesta:</strong>{' '}
                      {formatearFecha(solicitud.fecha_respuesta)}
                    </p>
                  )}

                  {solicitud.observaciones && (
                    <p>
                      <strong>Observaciones registradas:</strong>{' '}
                      {solicitud.observaciones}
                    </p>
                  )}
                </div>

                {pendiente && (
                  <div className="slb-respuesta">
                    <label>
                      <span>Observaciones para el docente (opcional)</span>
                      <textarea
                        rows={3}
                        value={observaciones[solicitud.id] || ''}
                        onChange={(e) =>
                          setObservaciones((actuales) => ({
                            ...actuales,
                            [solicitud.id]: e.target.value,
                          }))
                        }
                        placeholder="Motivo de rechazo, condiciones o información adicional..."
                        disabled={procesando}
                        maxLength={1000}
                      />
                    </label>

                    <div className="slb-acciones">
                      <button
                        type="button"
                        className="slb-btn slb-btn-rechazar"
                        onClick={() =>
                          responderSolicitud(solicitud, 'rechazada')
                        }
                        disabled={Boolean(procesandoId)}
                      >
                        {procesando ? 'Procesando...' : 'Rechazar'}
                      </button>

                      <button
                        type="button"
                        className="slb-btn slb-btn-aprobar"
                        onClick={() =>
                          responderSolicitud(solicitud, 'aprobada')
                        }
                        disabled={Boolean(procesandoId)}
                      >
                        {procesando ? 'Procesando...' : 'Aprobar y habilitar lectura'}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
