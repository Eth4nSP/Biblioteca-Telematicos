import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import '../../styles/Estudiante/ExplorarColeccionesEstudiante.css';

export default function ExplorarColeccionesEstudiante() {
  const [colecciones, setColecciones] = useState([]);
  const [solicitudes, setSolicitudes] = useState({});
  const [membresias, setMembresias] = useState(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [solicitandoId, setSolicitandoId] = useState(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Estados de UX para filtros rápidos y paginación (Agrégales antes del return)
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [paginaActual, setPaginaActual] = useState(1);
  const COLECCIONES_POR_PAGINA = 9;

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const usuario = authData?.user;

      if (!usuario) {
        throw new Error(
          'Debes iniciar sesión para explorar colecciones.'
        );
      }

      const { data: perfil, error: perfilError } =
        await supabase
          .from('perfiles')
          .select('id, rol')
          .eq('id', usuario.id)
          .single();

      if (perfilError) throw perfilError;

      if (
        (perfil?.rol || '').trim().toLowerCase() !== 'estudiante'
      ) {
        throw new Error(
          'Esta sección es exclusiva para estudiantes.'
        );
      }

      // Solo devuelve colecciones activas con modalidad "inscripcion".
      // Las colecciones con código no se muestran aquí.
      const {
        data: lista,
        error: coleccionesError,
      } = await supabase.rpc('listar_colecciones_explorables');

      if (coleccionesError) throw coleccionesError;

      // Defensa adicional en el cliente: mostrar exclusivamente
      // colecciones de inscripción, aunque la RPC devuelva otras.
      const coleccionesInscripcion = (lista || []).filter(
        (coleccion) =>
          coleccion.activa === true &&
          coleccion.modalidad_acceso === 'inscripcion'
      );

      // Obtener las membresías activas del estudiante.
      const {
        data: membresiasData,
        error: membresiasError,
      } = await supabase
        .from('coleccion_estudiantes')
        .select('coleccion_id')
        .eq('estudiante_id', usuario.id)
        .eq('activo', true);

      if (membresiasError) throw membresiasError;

      // Obtener el estado de sus solicitudes.
      const {
        data: solicitudesData,
        error: solicitudesError,
      } = await supabase
        .from('solicitudes_coleccion')
        .select('coleccion_id, estado')
        .eq('estudiante_id', usuario.id);

      if (solicitudesError) throw solicitudesError;

      const estados = {};

      (solicitudesData || []).forEach((solicitud) => {
        estados[solicitud.coleccion_id] = solicitud.estado;
      });

      setColecciones(coleccionesInscripcion);
      setSolicitudes(estados);
      setMembresias(
        new Set(
          (membresiasData || []).map(
            (membresia) => membresia.coleccion_id
          )
        )
      );
    } catch (err) {
      console.error(
        'Error al explorar colecciones:',
        err
      );

      setError(
        err.message ||
          'No se pudieron cargar las colecciones.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const solicitarAcceso = async (coleccion) => {
    setError('');
    setMensaje('');

    // No permitir solicitudes si ya tiene acceso o hay una
    // solicitud pendiente o aprobada.
    if (membresias.has(coleccion.id)) {
      setMensaje('Ya tienes acceso a esta colección.');
      return;
    }

    const estadoActual = solicitudes[coleccion.id];

    if (
      estadoActual === 'pendiente' ||
      estadoActual === 'aprobada'
    ) {
      return;
    }

    setSolicitandoId(coleccion.id);

    try {
      const { error: solicitudError } = await supabase.rpc(
        'solicitar_acceso_coleccion',
        {
          p_coleccion_id: coleccion.id,
        }
      );

      if (solicitudError) throw solicitudError;

      setSolicitudes((actuales) => ({
        ...actuales,
        [coleccion.id]: 'pendiente',
      }));

      setMensaje(
        `Solicitud enviada para "${coleccion.nombre}".`
      );
    } catch (err) {
      console.error(
        'Error al solicitar acceso:',
        err
      );

      setError(
        err.message ||
          'No se pudo enviar la solicitud.'
      );

      // Actualizar estados por si la solicitud ya existía
      // o cambió mientras se realizaba la operación.
      await cargarDatos();
    } finally {
      setSolicitandoId(null);
    }
  };

  const coleccionesFiltradas = colecciones.filter(
    (coleccion) => {
      const texto = busqueda.trim().toLowerCase();

      return (
        !texto ||
        (coleccion.nombre || '')
          .toLowerCase()
          .includes(texto) ||
        (coleccion.descripcion || '')
          .toLowerCase()
          .includes(texto)
      );
    }
  );

  const etiquetaEstado = (coleccion) => {
    if (membresias.has(coleccion.id)) {
      return 'Ya tienes acceso';
    }

    switch (solicitudes[coleccion.id]) {
      case 'pendiente':
        return 'Solicitud pendiente';

      case 'aprobada':
        return 'Solicitud aprobada';

      case 'rechazada':
        return 'Solicitud rechazada';

      default:
        return 'Disponible para solicitar acceso';
    }
  };

  if (cargando) {
    return (
      <main className="ece-container">
        <p>Cargando colecciones...</p>
      </main>
    );
  }

 // Filtrado combinado: tu búsqueda + píldoras de estado
  const coleccionesVisibles = coleccionesFiltradas.filter((coleccion) => {
    const tieneAcceso = membresias.has(coleccion.id);
    const estado = solicitudes[coleccion.id];

    if (filtroEstado === "acceso") return tieneAcceso || estado === "aprobada";
    if (filtroEstado === "pendientes") return !tieneAcceso && estado === "pendiente";
    if (filtroEstado === "disponibles") return !tieneAcceso && estado !== "pendiente";
    return true;
  });

  const totalPaginas = Math.max(
    1,
    Math.ceil(coleccionesVisibles.length / COLECCIONES_POR_PAGINA)
  );

  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const coleccionesPaginadas = coleccionesVisibles.slice(
    (paginaSegura - 1) * COLECCIONES_POR_PAGINA,
    paginaSegura * COLECCIONES_POR_PAGINA
  );

  return (
    <main className="ece-container">
      {/* HERO COMPACTO ESTILO BOSQUE DEL SABER */}
      <header className="ece-hero">
        <div className="ece-hero-top">
          <div className="ece-hero-text">
            <span className="ece-eyebrow">
              🌿 SANTUARIO ACADÉMICO • RUTAS DE ESTUDIO
            </span>
            <h1>Explorar Colecciones</h1>
            <p>
              Descubre las colecciones bibliográficas curadas por tus docentes y
              solicita acceso para consultar sus materiales selectos.
            </p>
          </div>

          <button
            type="button"
            className="ece-button ece-button-refresh"
            onClick={cargarDatos}
            disabled={cargando}
          >
            <span>{cargando ? "⏳" : "↻"}</span>
            <span>{cargando ? "Sincronizando…" : "Actualizar"}</span>
          </button>
        </div>

        {/* BARRA DE BÚSQUEDA FLOTANTE (ESTILO MOCKUP) */}
        <div className="ece-search-bar">
          <span className="ece-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            className="ece-search-input"
            type="search"
            placeholder="Buscar colecciones por nombre, materia o descripción..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
          />
          {busqueda && (
            <button
              type="button"
              className="ece-search-clear"
              onClick={() => {
                setBusqueda("");
                setPaginaActual(1);
              }}
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
          <span className="ece-search-badge">
            {coleccionesVisibles.length}{" "}
            {coleccionesVisibles.length === 1 ? "resultado" : "resultados"}
          </span>
        </div>
      </header>

      {/* ALERTAS DE ESTADO */}
      {error && (
        <div className="ece-alert ece-error" role="alert">
          <span>⚠️ {error}</span>
        </div>
      )}

      {mensaje && (
        <div className="ece-alert ece-success" role="status">
          <span>🌱 {mensaje}</span>
        </div>
      )}

      {/* SECCIÓN PRINCIPAL DE COLECCIONES */}
      <section className="ece-section">
        <div className="ece-toolbar">
          <div className="ece-section-heading">
            <h2>Colecciones disponibles para inscripción</h2>
            <p>
              Explora los herbarios de lectura organizados por cátedra y área
              académica.
            </p>
          </div>

          {/* PÍLDORAS DE FILTRO RÁPIDO */}
          <div
            className="ece-filter-pills"
            role="tablist"
            aria-label="Filtrar colecciones por estado"
          >
            {[
              { id: "todas", label: "Todas" },
              { id: "disponibles", label: "Disponibles" },
              { id: "pendientes", label: "Pendientes" },
              { id: "acceso", label: "Con Acceso" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filtroEstado === tab.id}
                className={`ece-pill ${
                  filtroEstado === tab.id ? "activo" : ""
                }`}
                onClick={() => {
                  setFiltroEstado(tab.id);
                  setPaginaActual(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {coleccionesVisibles.length === 0 ? (
          <div className="ece-empty">
            <span className="ece-empty-icon">🍃</span>
            <h3>No se encontraron colecciones en este sendero</h3>
            <p>
              {busqueda || filtroEstado !== "todas"
                ? "No hay colecciones que coincidan con tu filtro actual. Prueba limpiando la búsqueda."
                : "No se encontraron colecciones abiertas a solicitudes de inscripción en este momento."}
            </p>
            {(busqueda || filtroEstado !== "todas") && (
              <button
                type="button"
                className="ece-button ece-button-primary"
                style={{ width: "auto", marginTop: 12 }}
                onClick={() => {
                  setBusqueda("");
                  setFiltroEstado("todas");
                  setPaginaActual(1);
                }}
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="ece-grid">
              {coleccionesPaginadas.map((coleccion) => {
                const tieneAcceso = membresias.has(coleccion.id);
                const estado = solicitudes[coleccion.id];

                return (
                  <article className="ece-card" key={coleccion.id}>
                    <div className="ece-card-top">
                      <div className="ece-card-icon" aria-hidden="true">
                        {tieneAcceso
                          ? "🔓"
                          : estado === "pendiente"
                          ? "⏳"
                          : "📚"}
                      </div>

                      <span
                        className={`ece-status ${
                          tieneAcceso
                            ? "ece-status-success"
                            : estado === "pendiente"
                            ? "ece-status-pending"
                            : estado === "rechazada"
                            ? "ece-status-rejected"
                            : ""
                        }`}
                      >
                        {etiquetaEstado(coleccion)}
                      </span>
                    </div>

                    <div className="ece-card-body">
                      <span className="ece-tag">
                        🌱 Colección Académica • Solicitud
                      </span>

                      <h3>{coleccion.nombre}</h3>

                      <p className="ece-description">
                        {coleccion.descripcion ||
                          "Sin descripción detallada proporcionada por el docente."}
                      </p>

                      <div className="ece-card-footer">
                        {tieneAcceso ? (
                          <div className="ece-access-granted">
                            <span className="ece-access-dot">●</span>
                            <p className="ece-note">
                              Ya tienes acceso. Consúltala desde{" "}
                              <strong>«Mis colecciones»</strong>.
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`ece-button ${
                              estado === "pendiente"
                                ? "ece-button-pending"
                                : "ece-button-primary"
                            }`}
                            onClick={() => solicitarAcceso(coleccion)}
                            disabled={
                              estado === "pendiente" ||
                              estado === "aprobada" ||
                              solicitandoId === coleccion.id
                            }
                          >
                            {solicitandoId === coleccion.id
                              ? "Enviando solicitud..."
                              : estado === "pendiente"
                              ? "⏳ Solicitud en revisión"
                              : estado === "aprobada"
                              ? "✓ Acceso aprobado"
                              : estado === "rechazada"
                              ? "↻ Volver a solicitar"
                              : "Solicitar acceso →"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* PAGINACIÓN DINÁMICA DE COLECCIONES */}
            {totalPaginas > 1 && (
              <div className="bosque-historial-paginacion ece-pagination">
                <span className="bosque-paginacion-info">
                  Mostrando <strong>{coleccionesPaginadas.length}</strong> de{" "}
                  <strong>{coleccionesVisibles.length}</strong> colecciones (Página{" "}
                  <strong>{paginaSegura}</strong> de{" "}
                  <strong>{totalPaginas}</strong>)
                </span>

                <div className="bosque-paginacion-botones">
                  <button
                    type="button"
                    className="bosque-btn-pag"
                    onClick={() =>
                      setPaginaActual((prev) => Math.max(1, prev - 1))
                    }
                    disabled={paginaSegura === 1}
                  >
                    ‹ Anterior
                  </button>

                  {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(
                    (num) => (
                      <button
                        key={num}
                        type="button"
                        className={`bosque-btn-pag-num ${
                          paginaSegura === num ? "activo" : ""
                        }`}
                        onClick={() => setPaginaActual(num)}
                      >
                        {num}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    className="bosque-btn-pag"
                    onClick={() =>
                      setPaginaActual((prev) =>
                        Math.min(totalPaginas, prev + 1)
                      )
                    }
                    disabled={paginaSegura === totalPaginas}
                  >
                    Siguiente ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
