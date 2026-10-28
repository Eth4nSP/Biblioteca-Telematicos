import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient.js';
import '../../../styles/Bibliotecario/PrestamosDigitales.css';

const ZONA_HORARIA = 'America/La_Paz';

const estilos = {
  contenedor: {
    padding: '24px',
    color: '#1f2937',
  },
  encabezado: {
    marginBottom: '24px',
  },
  titulo: {
    margin: '0 0 8px',
    fontSize: '28px',
    fontWeight: 700,
  },
  descripcion: {
    margin: 0,
    color: '#64748b',
  },
  estadisticas: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  tarjetaEstadistica: {
    padding: '18px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#ffffff',
  },
  numero: {
    display: 'block',
    marginTop: '8px',
    fontSize: '28px',
    fontWeight: 700,
  },
  formulario: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#ffffff',
  },
  campo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  etiqueta: {
    fontSize: '14px',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#ffffff',
    color: '#1f2937',
  },
  boton: {
    padding: '11px 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  botonSecundario: {
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '7px',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
  },
  filtros: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '18px',
  },
  tablaContenedor: {
    overflowX: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    background: '#ffffff',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '14px 12px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '13px 12px',
    borderBottom: '1px solid #e2e8f0',
    verticalAlign: 'middle',
  },
  mensaje: {
    padding: '12px 16px',
    marginBottom: '18px',
    borderRadius: '8px',
  },
  vacio: {
    padding: '36px 20px',
    textAlign: 'center',
    color: '#64748b',
  },
};

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Convierte una fecha a sus partes en la zona horaria de Bolivia.
 */
function partesFechaBolivia(fecha) {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
}

function obtenerParte(partes, tipo) {
  return partes.find((parte) => parte.type === tipo)?.value ?? '';
}

/**
 * Presentación fija: dd/mm/aaaa HH:mm.
 * No depende del formato regional de Windows o del navegador.
 */
function fechaLegible(fecha) {
  if (!fecha) return '—';

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return '—';

  const partes = partesFechaBolivia(valor);

  return `${obtenerParte(partes, 'day')}/${obtenerParte(
    partes,
    'month'
  )}/${obtenerParte(partes, 'year')} ${obtenerParte(
    partes,
    'hour'
  )}:${obtenerParte(partes, 'minute')}`;
}

/**
 * Obtiene una fecha inicial de vencimiento: siete días desde ahora,
 * expresada en la hora local de Bolivia.
 */
function obtenerVencimientoInicial() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 7);

  const partes = partesFechaBolivia(fecha);

  return `${obtenerParte(partes, 'day')}/${obtenerParte(
    partes,
    'month'
  )}/${obtenerParte(partes, 'year')} ${obtenerParte(
    partes,
    'hour'
  )}:${obtenerParte(partes, 'minute')}`;
}

/**
 * Convierte dd/mm/aaaa HH:mm a un instante ISO utilizando UTC-4,
 * correspondiente a la hora de Bolivia.
 */
function fechaBolivianaAISO(valor) {
  const coincidencia = String(valor ?? '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);

  if (!coincidencia) {
    throw new Error('Ingresa la fecha con el formato dd/mm/aaaa HH:mm.');
  }

  const [, diaTexto, mesTexto, anioTexto, horaTexto, minutoTexto] =
    coincidencia;

  const dia = Number(diaTexto);
  const mes = Number(mesTexto);
  const anio = Number(anioTexto);
  const hora = Number(horaTexto);
  const minuto = Number(minutoTexto);

  if (
    anio < 1 ||
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    throw new Error('La fecha u hora ingresada no es válida.');
  }

  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  if (dia > diasDelMes) {
    throw new Error('El día no existe en el mes seleccionado.');
  }

  const fechaISO = `${String(anio).padStart(4, '0')}-${mesTexto}-${diaTexto}T${horaTexto}:${minutoTexto}:00-04:00`;

  const fecha = new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) {
    throw new Error('No se pudo interpretar la fecha ingresada.');
  }

  return fecha.toISOString();
}

function estadoPrestamo(prestamo) {
  if (prestamo.devuelto_en) return 'Devuelto';

  if (new Date(prestamo.vence_en).getTime() < Date.now()) {
    return 'Vencido';
  }

  return 'Activo';
}

function colorEstado(estado) {
  const colores = {
    Activo: { fondo: '#dcfce7', texto: '#166534' },
    Vencido: { fondo: '#fee2e2', texto: '#991b1b' },
    Devuelto: { fondo: '#e2e8f0', texto: '#334155' },
  };

  return colores[estado] ?? colores.Devuelto;
}

export default function PrestamosDigitales() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [libros, setLibros] = useState([]);
  const [prestamos, setPrestamos] = useState([]);

  const [estudianteId, setEstudianteId] = useState('');
  const [recursoId, setRecursoId] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState(
    obtenerVencimientoInicial
  );

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroOrigen, setFiltroOrigen] = useState('todos');

  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [prestamoProcesando, setPrestamoProcesando] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargarDatos = useCallback(async (mostrarCarga = false) => {
    if (mostrarCarga) setCargando(true);

    try {
      const [estudiantesResp, librosResp, prestamosResp] =
        await Promise.all([
          supabase
            .from('perfiles')
            .select('id, nombre_completo')
            .eq('rol', 'estudiante')
            .order('nombre_completo', { ascending: true }),

          supabase
            .from('recursos_bibliograficos')
            .select('id, titulo, autor, tipo_recurso')
            .order('titulo', { ascending: true }),

          supabase
            .from('prestamos_libros')
            .select(
              'id, usuario_id, recurso_id, prestado_en, vence_en, devuelto_en, origen_prestamo, registrado_por'
            )
            .order('prestado_en', { ascending: false }),
        ]);

      const error =
        estudiantesResp.error ||
        librosResp.error ||
        prestamosResp.error;

      if (error) throw error;

      setEstudiantes(estudiantesResp.data ?? []);
      setLibros(librosResp.data ?? []);
      setPrestamos(prestamosResp.data ?? []);
    } catch (error) {
      console.error('Error al cargar los préstamos digitales:', error);

      setMensaje({
        tipo: 'error',
        texto:
          error.message ||
          'No se pudieron cargar los datos. Comprueba los permisos de acceso.',
      });
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos(true);
  }, [cargarDatos]);

  const estudiantesPorId = useMemo(
    () =>
      new Map(
        estudiantes.map((estudiante) => [
          estudiante.id,
          estudiante,
        ])
      ),
    [estudiantes]
  );

  const librosPorId = useMemo(
    () =>
      new Map(
        libros.map((libro) => [libro.id, libro])
      ),
    [libros]
  );

  const prestamosCompletos = useMemo(
    () =>
      prestamos.map((prestamo) => ({
        ...prestamo,
        estudiante: estudiantesPorId.get(prestamo.usuario_id),
        libro: librosPorId.get(prestamo.recurso_id),
        estado: estadoPrestamo(prestamo),
      })),
    [prestamos, estudiantesPorId, librosPorId]
  );

  const estadisticas = useMemo(() => {
    return {
      total: prestamosCompletos.length,
      activos: prestamosCompletos.filter(
        (prestamo) => prestamo.estado === 'Activo'
      ).length,
      vencidos: prestamosCompletos.filter(
        (prestamo) => prestamo.estado === 'Vencido'
      ).length,
      devueltos: prestamosCompletos.filter(
        (prestamo) => prestamo.estado === 'Devuelto'
      ).length,
    };
  }, [prestamosCompletos]);

  const prestamosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda);

    return prestamosCompletos.filter((prestamo) => {
      const nombre = prestamo.estudiante?.nombre_completo ?? '';
      const titulo = prestamo.libro?.titulo ?? '';
      const autor = prestamo.libro?.autor ?? '';

      const coincideBusqueda =
        !termino ||
        normalizarTexto(nombre).includes(termino) ||
        normalizarTexto(titulo).includes(termino) ||
        normalizarTexto(autor).includes(termino);

      const coincideEstado =
        filtroEstado === 'todos' ||
        prestamo.estado.toLowerCase() === filtroEstado;

      const coincideOrigen =
        filtroOrigen === 'todos' ||
        prestamo.origen_prestamo === filtroOrigen;

      return coincideBusqueda && coincideEstado && coincideOrigen;
    });
  }, [
    prestamosCompletos,
    busqueda,
    filtroEstado,
    filtroOrigen,
  ]);

  async function registrarPrestamo(evento) {
    evento.preventDefault();
    setMensaje(null);

    if (!estudianteId || !recursoId) {
      setMensaje({
        tipo: 'error',
        texto: 'Selecciona un estudiante y un recurso digital.',
      });
      return;
    }

    let vencimientoISO;

    try {
      vencimientoISO = fechaBolivianaAISO(fechaVencimiento);
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto: error.message,
      });
      return;
    }

    if (new Date(vencimientoISO).getTime() <= Date.now()) {
      setMensaje({
        tipo: 'error',
        texto: 'El vencimiento debe ser una fecha futura.',
      });
      return;
    }

    setRegistrando(true);

    try {
      const { error } = await supabase.rpc(
        'registrar_prestamo_bibliotecario',
        {
          p_estudiante_id: estudianteId,
          p_recurso_id: recursoId,
          p_vence_en: vencimientoISO,
        }
      );

      if (error) throw error;

      setMensaje({
        tipo: 'exito',
        texto: 'El préstamo digital se registró correctamente.',
      });

      setEstudianteId('');
      setRecursoId('');
      setFechaVencimiento(obtenerVencimientoInicial());

      await cargarDatos(false);
    } catch (error) {
      console.error('Error al registrar el préstamo:', error);

      setMensaje({
        tipo: 'error',
        texto:
          error.message ||
          'No se pudo registrar el préstamo digital.',
      });
    } finally {
      setRegistrando(false);
    }
  }

  async function revocarAcceso(prestamo) {
    const confirmar = window.confirm(
      `¿Deseas registrar la devolución del recurso "${
        prestamo.libro?.titulo ?? 'digital'
      }" prestado a ${
        prestamo.estudiante?.nombre_completo ?? 'este estudiante'
      }?`
    );

    if (!confirmar) return;

    setPrestamoProcesando(prestamo.id);
    setMensaje(null);

    try {
      const { data, error } = await supabase.rpc(
        'registrar_devolucion_bibliotecario',
        {
          p_prestamo_id: prestamo.id,
        }
      );

      if (error) throw error;

      if (data?.ok === false) {
        throw new Error(
          data.mensaje || 'No se pudo registrar la devolución.'
        );
      }

      setMensaje({
        tipo: 'exito',
        texto: 'La devolución se registró correctamente.',
      });

      await cargarDatos(false);
    } catch (error) {
      console.error('Error al registrar la devolución:', error);

      setMensaje({
        tipo: 'error',
        texto:
          error.message ||
          'No se pudo registrar la devolución del préstamo.',
      });
    } finally {
      setPrestamoProcesando(null);
    }
  }

  return (
    <main style={estilos.contenedor}>
      <header style={estilos.encabezado}>
        <h1 style={estilos.titulo}>Préstamos digitales</h1>
        <p style={estilos.descripcion}>
          Administra los préstamos, sus vencimientos y las devoluciones
          de los recursos digitales.
        </p>
      </header>

      <section style={estilos.estadisticas}>
        {[
          { etiqueta: 'Total de préstamos', valor: estadisticas.total },
          { etiqueta: 'Activos', valor: estadisticas.activos },
          { etiqueta: 'Vencidos', valor: estadisticas.vencidos },
          { etiqueta: 'Devueltos', valor: estadisticas.devueltos },
        ].map((dato) => (
          <article
            key={dato.etiqueta}
            style={estilos.tarjetaEstadistica}
          >
            <span>{dato.etiqueta}</span>
            <strong style={estilos.numero}>{dato.valor}</strong>
          </article>
        ))}
      </section>

      <section>
        <h2>Registrar préstamo</h2>

        <form
          onSubmit={registrarPrestamo}
          style={estilos.formulario}
        >
          <div style={estilos.campo}>
            <label style={estilos.etiqueta} htmlFor="estudiante-prestamo">
              Estudiante
            </label>

            <select
              id="estudiante-prestamo"
              style={estilos.input}
              value={estudianteId}
              onChange={(e) => setEstudianteId(e.target.value)}
              required
              disabled={registrando || cargando}
            >
              <option value="">Selecciona un estudiante</option>

              {estudiantes.map((estudiante) => (
                <option key={estudiante.id} value={estudiante.id}>
                  {estudiante.nombre_completo}
                </option>
              ))}
            </select>
          </div>

          <div style={estilos.campo}>
            <label style={estilos.etiqueta} htmlFor="recurso-prestamo">
              Recurso digital
            </label>

            <select
              id="recurso-prestamo"
              style={estilos.input}
              value={recursoId}
              onChange={(e) => setRecursoId(e.target.value)}
              required
              disabled={registrando || cargando}
            >
              <option value="">Selecciona un recurso</option>

              {libros.map((libro) => (
                <option key={libro.id} value={libro.id}>
                  {libro.titulo}
                  {libro.autor ? ` — ${libro.autor}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={estilos.campo}>
            <label
              style={estilos.etiqueta}
              htmlFor="vencimiento-prestamo"
            >
              Fecha y hora de vencimiento
            </label>

            <input
              id="vencimiento-prestamo"
              type="text"
              style={estilos.input}
              placeholder="dd/mm/aaaa HH:mm"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              pattern="\d{2}/\d{2}/\d{4} \d{2}:\d{2}"
              title="Introduce la fecha como dd/mm/aaaa HH:mm. Ejemplo: 04/11/2026 18:30"
              autoComplete="off"
              required
              disabled={registrando}
            />

            <small style={{ color: '#64748b' }}>
              Hora de Bolivia (UTC−4). Ejemplo: 04/11/2026 18:30.
            </small>
          </div>

          <div
            style={{
              ...estilos.campo,
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="submit"
              style={{
                ...estilos.boton,
                opacity: registrando ? 0.65 : 1,
              }}
              disabled={registrando || cargando}
            >
              {registrando ? 'Registrando…' : 'Registrar préstamo'}
            </button>
          </div>
        </form>
      </section>

      {mensaje && (
        <div
          role={mensaje.tipo === 'error' ? 'alert' : 'status'}
          style={{
            ...estilos.mensaje,
            background:
              mensaje.tipo === 'error' ? '#fee2e2' : '#dcfce7',
            color:
              mensaje.tipo === 'error' ? '#991b1b' : '#166534',
          }}
        >
          {mensaje.texto}
          <button
            type="button"
            onClick={() => setMensaje(null)}
            aria-label="Cerrar mensaje"
            style={{
              float: 'right',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <section>
        <h2>Listado de préstamos</h2>

        <div style={estilos.filtros}>
          <input
            type="search"
            style={estilos.input}
            placeholder="Buscar estudiante, título o autor…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar préstamos"
          />

          <select
            style={estilos.input}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="vencido">Vencidos</option>
            <option value="devuelto">Devueltos</option>
          </select>

          <select
            style={estilos.input}
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value)}
            aria-label="Filtrar por origen"
          >
            <option value="todos">Todos los orígenes</option>
            <option value="estudiante">Solicitados por estudiantes</option>
            <option value="bibliotecario">Registrados por bibliotecario</option>
          </select>

          <button
            type="button"
            style={estilos.botonSecundario}
            onClick={() => {
              setBusqueda('');
              setFiltroEstado('todos');
              setFiltroOrigen('todos');
            }}
          >
            Limpiar filtros
          </button>

          <button
            type="button"
            style={estilos.botonSecundario}
            onClick={() => cargarDatos(true)}
            disabled={cargando}
          >
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {cargando ? (
          <div style={estilos.vacio}>Cargando préstamos digitales…</div>
        ) : prestamosFiltrados.length === 0 ? (
          <div style={estilos.vacio}>
            <h3>No hay préstamos para mostrar</h3>
            <p>Prueba con otros filtros o registra un nuevo préstamo.</p>
          </div>
        ) : (
          <div style={estilos.tablaContenedor}>
            <table style={estilos.tabla}>
              <thead>
                <tr>
                  <th style={estilos.th}>Estudiante</th>
                  <th style={estilos.th}>Recurso digital</th>
                  <th style={estilos.th}>Fecha de préstamo</th>
                  <th style={estilos.th}>Vencimiento</th>
                  <th style={estilos.th}>Origen</th>
                  <th style={estilos.th}>Estado</th>
                  <th style={estilos.th}>Devolución</th>
                  <th style={estilos.th}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {prestamosFiltrados.map((prestamo) => {
                  const colores = colorEstado(prestamo.estado);
                  const puedeDevolver = prestamo.estado !== 'Devuelto';

                  return (
                    <tr key={prestamo.id}>
                      <td style={estilos.td}>
                        {prestamo.estudiante?.nombre_completo ??
                          'Estudiante no disponible'}
                      </td>

                      <td style={estilos.td}>
                        <strong>
                          {prestamo.libro?.titulo ??
                            'Recurso no disponible'}
                        </strong>

                        {prestamo.libro?.autor && (
                          <div
                            style={{
                              marginTop: '4px',
                              color: '#64748b',
                              fontSize: '12px',
                            }}
                          >
                            {prestamo.libro.autor}
                          </div>
                        )}
                      </td>

                      <td style={estilos.td}>
                        {fechaLegible(prestamo.prestado_en)}
                      </td>

                      <td style={estilos.td}>
                        {fechaLegible(prestamo.vence_en)}
                      </td>

                      <td style={estilos.td}>
                        {prestamo.origen_prestamo === 'bibliotecario'
                          ? 'Bibliotecario'
                          : 'Estudiante'}
                      </td>

                      <td style={estilos.td}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '5px 9px',
                            borderRadius: '20px',
                            background: colores.fondo,
                            color: colores.texto,
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {prestamo.estado}
                        </span>
                      </td>

                      <td style={estilos.td}>
                        {fechaLegible(prestamo.devuelto_en)}
                      </td>

                      <td style={estilos.td}>
                        {puedeDevolver ? (
                          <button
                            type="button"
                            style={{
                              ...estilos.botonSecundario,
                              opacity:
                                prestamoProcesando === prestamo.id
                                  ? 0.6
                                  : 1,
                            }}
                            disabled={
                              prestamoProcesando !== null ||
                              cargando
                            }
                            onClick={() => revocarAcceso(prestamo)}
                          >
                            {prestamoProcesando === prestamo.id
                              ? 'Procesando…'
                              : 'Registrar devolución'}
                          </button>
                        ) : (
                          <span style={{ color: '#64748b' }}>
                            Sin acciones
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ color: '#64748b', fontSize: '13px' }}>
          Mostrando {prestamosFiltrados.length} de {prestamos.length}{' '}
          préstamos. Las fechas se presentan en hora de Bolivia.
        </p>
      </section>
    </main>
  );
}