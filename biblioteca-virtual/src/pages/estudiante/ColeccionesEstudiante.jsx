import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import VisorDocumento from '../../components/VisorDocumento.jsx';
import '../../styles/Estudiante/ColeccionesEstudiante.css';

const DURACION_URL_PORTADA = 55 * 60 * 1000;
const VIGENCIA_URL_PORTADA = 60 * 60;

const cachePortadas = new Map();

/**
 * Obtiene la ruta del archivo dentro del bucket privado "libros".
 * También admite URL externas y rutas relativas de Storage.
 */
function obtenerRutaPortada(valor) {
  if (!valor || typeof valor !== 'string') {
    return null;
  }

  const valorLimpio = valor.trim();

  if (!valorLimpio) {
    return null;
  }

  // Una ruta sin protocolo se considera una ruta de Storage.
  if (!/^https?:\/\//i.test(valorLimpio)) {
    return valorLimpio.replace(/^\/+/, '');
  }

  try {
    const url = new URL(valorLimpio);

    const segmentosStorage = [
      '/storage/v1/object/public/libros/',
      '/storage/v1/object/sign/libros/',
      '/storage/v1/object/authenticated/libros/',
    ];

    for (const segmento of segmentosStorage) {
      const indice = url.pathname.indexOf(segmento);

      if (indice !== -1) {
        const rutaCodificada = url.pathname.slice(
          indice + segmento.length
        );

        return rutaCodificada
          .split('/')
          .map((parte) => decodeURIComponent(parte))
          .join('/');
      }
    }

    // No es una URL del bucket "libros".
    return null;
  } catch (err) {
    console.warn(
      '[COLECCIONES] No se pudo interpretar la URL de portada:',
      err
    );

    return null;
  }
}

/**
 * Genera una URL firmada para portadas del bucket privado.
 * Si la portada es externa, conserva su URL original.
 */
async function obtenerPortadaFirmada(valor) {
  if (!valor || typeof valor !== 'string') {
    return null;
  }

  const valorLimpio = valor.trim();

  if (!valorLimpio) {
    return null;
  }

  const ruta = obtenerRutaPortada(valorLimpio);

  if (!ruta) {
    return /^https?:\/\//i.test(valorLimpio)
      ? valorLimpio
      : null;
  }

  const ahora = Date.now();
  const cache = cachePortadas.get(ruta);

  if (cache && cache.expira > ahora) {
    return cache.url;
  }

  const { data, error } = await supabase.storage
    .from('libros')
    .createSignedUrl(ruta, VIGENCIA_URL_PORTADA);

  if (error) {
    console.error(
      '[COLECCIONES] No se pudo firmar la portada:',
      ruta,
      error.message
    );

    return null;
  }

  const urlFirmada = data?.signedUrl ?? null;

  if (urlFirmada) {
    cachePortadas.set(ruta, {
      url: urlFirmada,
      expira: ahora + DURACION_URL_PORTADA,
    });
  }

  return urlFirmada;
}

export default function ColeccionesEstudiante() {
  const [estudianteId, setEstudianteId] = useState(null);
  const [colecciones, setColecciones] = useState([]);
  const [coleccionActiva, setColeccionActiva] = useState(null);
  const [libros, setLibros] = useState([]);
  const [libroAbierto, setLibroAbierto] = useState(null);

  const [codigo, setCodigo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [cargando, setCargando] = useState(true);
  const [uniendose, setUniendose] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  
  // Estado para paginar los libros de la colección abierta
  const [paginaLibros, setPaginaLibros] = useState(1);
  const LIBROS_POR_PAGINA = 8;

  // Referencia para hacer scroll automático a la estantería
  const seccionLibrosRef = useRef(null);

  const cargarColecciones = useCallback(async () => {
    setCargando(true);
    setError('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const usuario = authData?.user;

      if (!usuario) {
        throw new Error(
          'Debes iniciar sesión para ver tus colecciones.'
        );
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, rol')
        .eq('id', usuario.id)
        .single();

      if (perfilError) {
        throw perfilError;
      }

      if ((perfil?.rol || '').trim().toLowerCase() !== 'estudiante') {
        throw new Error(
          'Esta sección es exclusiva para estudiantes.'
        );
      }

      setEstudianteId(usuario.id);

      const { data: membresias, error: membresiasError } =
        await supabase
          .from('coleccion_estudiantes')
          .select('coleccion_id')
          .eq('estudiante_id', usuario.id)
          .eq('activo', true);

      if (membresiasError) {
        throw membresiasError;
      }

      const ids = (membresias || []).map(
        (membresia) => membresia.coleccion_id
      );

      if (ids.length === 0) {
        setColecciones([]);
        setColeccionActiva(null);
        setLibros([]);
        return;
      }

      const {
        data: datosColecciones,
        error: coleccionesError,
      } = await supabase
        .from('colecciones')
        .select(`
          id,
          nombre,
          descripcion,
          docente_id,
          modalidad_acceso,
          activa,
          fecha_creacion
        `)
        .in('id', ids)
        .eq('activa', true)
        .order('fecha_creacion', { ascending: false });

      if (coleccionesError) {
        throw coleccionesError;
      }

      const lista = datosColecciones || [];

      setColecciones(lista);

      const seleccionActual = lista.find(
        (coleccion) => coleccion.id === coleccionActiva?.id
      );

      if (seleccionActual) {
        setColeccionActiva(seleccionActual);
      } else {
        setColeccionActiva(null);
        setLibros([]);
      }
    } catch (err) {
      console.error(
        'Error al cargar colecciones:',
        err
      );

      setError(
        err.message ||
          'No se pudieron cargar las colecciones.'
      );
    } finally {
      setCargando(false);
    }
  }, [coleccionActiva?.id]);

  useEffect(() => {
    cargarColecciones();
  }, [cargarColecciones]);

  const abrirColeccion = async (coleccion) => {
    setError('');
    setMensaje('');
    setColeccionActiva(coleccion);
    setLibros([]);
    setBusqueda('');
    setCargando(true);

    try {
      const { data, error: librosError } = await supabase
        .from('coleccion_libros')
        .select(`
          id,
          coleccion_id,
          recurso_id,
          recurso:recursos_bibliograficos (
            id,
            titulo,
            autor,
            descripcion,
            tipo_recurso,
            portada_url,
            archivo_url,
            etiquetas
          )
        `)
        .eq('coleccion_id', coleccion.id);

      if (librosError) {
        throw librosError;
      }

      const recursos = (data || [])
        .filter((item) => item.recurso)
        .map((item) => item.recurso);

      // Resolver las portadas igual que en el catálogo.
      const recursosConPortadas = await Promise.all(
        recursos.map(async (libro) => {
          const portadaFirmada = await obtenerPortadaFirmada(
            libro.portada_url
          );

          return {
            ...libro,
            portadaFirmada,
          };
        })
      );

      setLibros(recursosConPortadas);

      // Desplazamiento automático y suave hacia la estantería de libros
      setTimeout(() => {
        if (seccionLibrosRef.current) {
          seccionLibrosRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 120);

    } catch (err) {
      console.error(
        'Error al cargar libros de la colección:',
        err
      );

      setError(
        err.message ||
          'No se pudieron cargar los libros de esta colección.'
      );
    } finally {
      setCargando(false);
    }
  };

  const unirseConCodigo = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!codigo.trim()) {
      setError(
        'Introduce el código que te compartió tu docente.'
      );
      return;
    }

    setUniendose(true);

    try {
      const { data, error: joinError } = await supabase.rpc(
        'unirse_coleccion_codigo',
        { p_codigo: codigo.trim() }
      );

      if (joinError) {
        throw joinError;
      }

      setCodigo('');
      setMensaje(
        'Te has unido correctamente a la colección.'
      );

      // Actualizar las colecciones disponibles.
      await cargarColecciones();

      const { data: coleccion, error: consultaError } =
        await supabase
          .from('colecciones')
          .select(`
            id,
            nombre,
            descripcion,
            docente_id,
            modalidad_acceso,
            activa,
            fecha_creacion
          `)
          .eq('id', data)
          .single();

      if (consultaError) {
        throw consultaError;
      }

      if (coleccion) {
        await abrirColeccion(coleccion);
        setMensaje(`Te has unido a "${coleccion.nombre}".`);
      }
    } catch (err) {
      console.error('Error al unirse a la colección:', err);

      setError(
        err.message ||
          'No se pudo usar el código. Verifica que sea válido.'
      );
    } finally {
      setUniendose(false);
    }
  };

  const librosFiltrados = libros.filter((libro) => {
    const texto = busqueda.trim().toLowerCase();

    return (
      !texto ||
      (libro.titulo || '').toLowerCase().includes(texto) ||
      (libro.autor || '').toLowerCase().includes(texto)
    );
  });

  if (libroAbierto) {
    return (
      <VisorDocumento
        libro={libroAbierto}
        onCerrar={() => setLibroAbierto(null)}
      />
    );
  }

  if (cargando && colecciones.length === 0) {
    return (
      <div className="ce-container">
        <p>Cargando tus colecciones...</p>
      </div>
    );
  }

  const totalPaginasLibros = Math.max(
    1,
    Math.ceil(librosFiltrados.length / LIBROS_POR_PAGINA)
  );

  const paginaLibrosSegura = Math.min(paginaLibros, totalPaginasLibros);
  const librosPaginados = librosFiltrados.slice(
    (paginaLibrosSegura - 1) * LIBROS_POR_PAGINA,
    paginaLibrosSegura * LIBROS_POR_PAGINA
  );

  return (
    <main className="ce-container">
      {/* HERO BANNER CON TARJETA DE CÓDIGO INTEGRADA */}
      <header className="ce-hero">
        <div className="ce-hero-main">
          <div className="ce-hero-top-row">
            <span className="ce-eyebrow">
              🌿 ESPACIO DEL ESTUDIANTE • HERBARIO PERSONAL
            </span>

            <button
              type="button"
              className="ce-button ce-button-refresh"
              onClick={cargarColecciones}
              disabled={cargando}
            >
              <span>{cargando ? "⏳" : "↻"}</span>
              <span>{cargando ? "Sincronizando…" : "Actualizar"}</span>
            </button>
          </div>

          <h1>Mis Colecciones</h1>

          <p>
            Accede al material bibliográfico y lecturas selectas que tus
            docentes comparten contigo en cada cátedra.
          </p>

          <div className="ce-hero-stats">
            <span className="ce-hero-pill">
              🗂️ <strong>{colecciones.length}</strong>{" "}
              {colecciones.length === 1
                ? "colección inscrita"
                : "colecciones inscritas"}
            </span>
            {coleccionActiva && (
              <span className="ce-hero-pill active">
                📖 Explorando: <strong>{coleccionActiva.nombre}</strong>
              </span>
            )}
          </div>
        </div>

        {/* TARJETA DE UNIRSE CON CÓDIGO (INTEGRADA EN EL HERO) */}
        <div className="ce-join-box">
          <div className="ce-join-box-header">
            <span className="ce-join-icon" aria-hidden="true">
              🔑
            </span>
            <div>
              <h2>Unirme con código</h2>
              <p>Ingresa la clave de 8 caracteres de tu docente</p>
            </div>
          </div>

          <form onSubmit={unirseConCodigo} className="ce-join-form">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="A7B9C2D4"
              maxLength={8}
              autoComplete="off"
              required
            />

            <button
              type="submit"
              className="ce-button ce-button-mint"
              disabled={uniendose}
            >
              {uniendose ? "Verificando..." : "Unirme →"}
            </button>
          </form>
        </div>
      </header>

      {/* ALERTAS DE RETROALIMENTACIÓN */}
      {error && (
        <div className="ce-alert ce-error" role="alert">
          <span>⚠️ {error}</span>
        </div>
      )}

      {mensaje && (
        <div className="ce-alert ce-success" role="status">
          <span>🌱 {mensaje}</span>
        </div>
      )}

      {/* LISTADO DE MIS COLECCIONES */}
      <section className="ce-section">
        <div className="ce-section-heading">
          <div>
            <h2>Estanterías de cátedra</h2>
            <p>
              Selecciona una colección para desplegar sus libros y documentos
              habilitados.
            </p>
          </div>

          <span className="ce-count-badge">
            {colecciones.length}{" "}
            {colecciones.length === 1 ? "disponible" : "disponibles"}
          </span>
        </div>

        {colecciones.length === 0 ? (
          <div className="ce-empty">
            <span className="ce-empty-icon">📚</span>
            <h3>Aún no perteneces a ninguna colección</h3>
            <p>
              Introduce el código proporcionado por tu docente en el recuadro
              superior o solicita acceso desde «Explorar colecciones».
            </p>
          </div>
        ) : (
          <div className="ce-grid">
            {colecciones.map((coleccion) => {
              const esActiva = coleccionActiva?.id === coleccion.id;

              return (
                <article
                  className={`ce-card ${esActiva ? "ce-card-activa" : ""}`}
                  key={coleccion.id}
                >
                  <div className="ce-card-top">
                    <div className="ce-card-icon" aria-hidden="true">
                      {esActiva ? "📂" : "📖"}
                    </div>

                    <span className="ce-mode-badge">
                      {coleccion.modalidad_acceso
                        ? `Acceso: ${coleccion.modalidad_acceso}`
                        : "Colección activa"}
                    </span>
                  </div>

                  <div className="ce-card-body">
                    <span className="ce-tag">
                      🌱 Colección Educativa • UMSS
                    </span>

                    <h3>{coleccion.nombre}</h3>

                    <p>
                      {coleccion.descripcion || "Sin descripción disponible."}
                    </p>

                    <div className="ce-card-footer">
                      <button
                        type="button"
                        className={`ce-button ${
                          esActiva
                            ? "ce-button-active-state"
                            : "ce-button-primary"
                        }`}
                        onClick={() => {
                          setPaginaLibros(1);
                          abrirColeccion(coleccion);
                        }}
                      >
                        {esActiva
                          ? "📖 Estantería enfocada"
                          : "Explorar libros →"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* PANEL EXPANDIDO: LIBROS DE LA COLECCIÓN ACTIVA (CON REFERENCIA DE AUTO-SCROLL) */}
      {coleccionActiva && (
        <section className="ce-books-section" ref={seccionLibrosRef} aria-live="polite">
          <div className="ce-books-header">
            <div className="ce-books-title-group">
              <span className="ce-books-eyebrow">
                📂 COLECCIÓN SELECCIONADA
              </span>
              <h2>{coleccionActiva.nombre}</h2>
              <p>
                {libros.length}{" "}
                {libros.length === 1
                  ? "recurso bibliográfico incluido"
                  : "recursos bibliográficos incluidos"}{" "}
                en esta estantería.
              </p>
            </div>

            <button
              type="button"
              className="ce-button ce-button-close"
              onClick={() => {
                setColeccionActiva(null);
                setLibros([]);
                setBusqueda("");
                setError("");
                setMensaje("");
                setPaginaLibros(1);
              }}
            >
              ✕ Cerrar colección
            </button>
          </div>

          {/* BUSCADOR TIPO PÍLDORA DENTRO DE LA COLECCIÓN */}
          <div className="ce-search-bar">
            <span className="ce-search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              className="ce-search-input"
              type="search"
              placeholder="Buscar libro por título o autor dentro de esta colección..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaLibros(1);
              }}
            />
            {busqueda && (
              <button
                type="button"
                className="ce-search-clear"
                onClick={() => {
                  setBusqueda("");
                  setPaginaLibros(1);
                }}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
            <span className="ce-search-count">
              {librosFiltrados.length}{" "}
              {librosFiltrados.length === 1 ? "libro" : "libros"}
            </span>
          </div>

          {cargando ? (
            <div className="ce-empty">
              <span className="ce-empty-icon">⏳</span>
              <h3>Abriendo estantería...</h3>
              <p>Cargando los libros de la colección seleccionada.</p>
            </div>
          ) : librosFiltrados.length === 0 ? (
            <div className="ce-empty">
              <span className="ce-empty-icon">🍃</span>
              <h3>No hay libros para mostrar</h3>
              <p>
                Puede que la colección todavía no tenga recursos asignados o
                que no haya coincidencias con tu búsqueda.
              </p>
            </div>
          ) : (
            <>
              <div className="ce-books-grid">
                {librosPaginados.map((libro) => (
                  <article className="ce-book-card" key={libro.id}>
                    <div className="ce-book-cover-wrap">
                      {libro.portadaFirmada ? (
                        <img
                          className="ce-book-cover"
                          src={libro.portadaFirmada}
                          alt={`Portada de ${libro.titulo}`}
                          loading="lazy"
                          onError={(e) => {
                            console.error(
                              "[COLECCIONES] No se pudo mostrar la portada:",
                              libro.titulo,
                              libro.portadaFirmada
                            );
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="ce-book-placeholder">
                          <span>📘</span>
                          <small>RECURSO DIGITAL</small>
                        </div>
                      )}
                    </div>

                    <div className="ce-book-info">
                      <span className="ce-book-badge">
                        {libro.tipo_recurso?.toUpperCase() || "LECTURA"}
                      </span>

                      <h3>{libro.titulo}</h3>

                      <p>{libro.autor || "Autor institucional"}</p>

                      <button
                        type="button"
                        className="ce-button ce-button-primary"
                        onClick={() => setLibroAbierto(libro)}
                      >
                        📖 Leer recurso
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {/* PAGINACIÓN DINÁMICA DE LIBROS */}
              {totalPaginasLibros > 1 && (
                <div className="bosque-historial-paginacion ce-books-pagination">
                  <span className="bosque-paginacion-info">
                    Mostrando <strong>{librosPaginados.length}</strong> de{" "}
                    <strong>{librosFiltrados.length}</strong> libros (Página{" "}
                    <strong>{paginaLibrosSegura}</strong> de{" "}
                    <strong>{totalPaginasLibros}</strong>)
                  </span>

                  <div className="bosque-paginacion-botones">
                    <button
                      type="button"
                      className="bosque-btn-pag"
                      onClick={() =>
                        setPaginaLibros((prev) => Math.max(1, prev - 1))
                      }
                      disabled={paginaLibrosSegura === 1}
                    >
                      ‹ Anterior
                    </button>

                    {Array.from(
                      { length: totalPaginasLibros },
                      (_, i) => i + 1
                    ).map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`bosque-btn-pag-num ${
                          paginaLibrosSegura === num ? "activo" : ""
                        }`}
                        onClick={() => setPaginaLibros(num)}
                      >
                        {num}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="bosque-btn-pag"
                      onClick={() =>
                        setPaginaLibros((prev) =>
                          Math.min(totalPaginasLibros, prev + 1)
                        )
                      }
                      disabled={paginaLibrosSegura === totalPaginasLibros}
                    >
                      Siguiente ›
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}