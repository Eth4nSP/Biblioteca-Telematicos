
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../../lib/supabaseClient.js";
import "../../styles/Estudiante/Catalogo.css";

const POR_PAGINA = 6;
const INTERVALO_ACTUALIZACION = 10000;
const DURACION_URL_PORTADA = 55 * 60 * 1000;
const VIGENCIA_URL_PORTADA = 60 * 60;

const cachePortadas = new Map();

const CAMPOS_CATALOGO = [
  "id",
  "titulo",
  "autor",
  "descripcion",
  "isbn",
  "etiquetas",
  "tipo_recurso",
  "portada_url",
  "archivo_url",
  "fecha_ingreso",
  "total_existencias",
  "sesiones_activas",
  "existencias_disponibles",
].join(", ");

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatearFecha(fecha) {
  if (!fecha) return "Sin fecha";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "Sin fecha";

  return valor.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function obtenerEtiquetas(libro) {
  if (!Array.isArray(libro.etiquetas)) return [];

  return libro.etiquetas.filter(
    (etiqueta) =>
      typeof etiqueta === "string" && etiqueta.trim(),
  );
}

function obtenerRutaPortada(valor) {
  if (!valor || typeof valor !== "string") return null;

  const valorLimpio = valor.trim();
  if (!valorLimpio) return null;

  if (!/^https?:\/\//i.test(valorLimpio)) {
    return valorLimpio.replace(/^\/+/, "");
  }

  try {
    const url = new URL(valorLimpio);

    const segmentos = [
      "/storage/v1/object/public/libros/",
      "/storage/v1/object/sign/libros/",
      "/storage/v1/object/authenticated/libros/",
    ];

    for (const segmento of segmentos) {
      const indice = url.pathname.indexOf(segmento);

      if (indice !== -1) {
        const ruta = url.pathname.slice(
          indice + segmento.length,
        );

        return ruta
          .split("/")
          .map((parte) => {
            try {
              return decodeURIComponent(parte);
            } catch {
              return parte;
            }
          })
          .join("/");
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function obtenerPortadaFirmada(valor) {
  if (!valor || typeof valor !== "string") return null;

  const valorLimpio = valor.trim();
  if (!valorLimpio) return null;

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

  try {
    const { data, error } = await supabase.storage
      .from("libros")
      .createSignedUrl(ruta, VIGENCIA_URL_PORTADA);

    if (error) {
      console.error("[PORTADAS]", error.message);
      return null;
    }

    const url = data?.signedUrl ?? null;

    if (url) {
      cachePortadas.set(ruta, {
        url,
        expira: ahora + DURACION_URL_PORTADA,
      });
    }

    return url;
  } catch (error) {
    console.error("[PORTADAS]", error);
    return null;
  }
}

export default function CatalogoLibrosEstudiante({
  idsPrestados,
  prestamosActivos,
  cuposDisponibles,
  operacionPrestamo,
  prestarLibro,
  abrirVisor,
  cargarPrestamos,
  cerrarSesion,
  cerrandoSesion,
}) {
  const [libros, setLibros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [actualizado, setActualizado] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [tipoSeleccionado, setTipoSeleccionado] =
    useState("todos");
  const [etiquetaSeleccionada, setEtiquetaSeleccionada] =
    useState("todas");
  const [orden, setOrden] = useState("recientes");
  const [pagina, setPagina] = useState(1);
  const [libroSeleccionado, setLibroSeleccionado] =
    useState(null);

  const cargarLibros = useCallback(async (mostrarCarga = false) => {
    if (mostrarCarga) setCargando(true);

    try {
      const { data, error: errorConsulta } = await supabase
        .from("v_catalogo_existencias")
        .select(CAMPOS_CATALOGO)
        .order("titulo", { ascending: true });

      if (errorConsulta) throw errorConsulta;

      const registros = data ?? [];

      const cargados = await Promise.all(
        registros.map(async (libro) => ({
          ...libro,
          portadaFirmada: await obtenerPortadaFirmada(
            libro.portada_url,
          ),
        })),
      );

      setLibros(cargados);
      setActualizado(new Date());
      setError("");
    } catch (err) {
      console.error("[CATALOGO]", err);
      setError(
        err?.message ||
          "No se pudo cargar el catálogo. Comprueba tu conexión.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarLibros(true);
    cargarPrestamos(false);

    const intervalo = window.setInterval(() => {
      cargarLibros(false);
      cargarPrestamos(false);
    }, INTERVALO_ACTUALIZACION);

    return () => window.clearInterval(intervalo);
  }, [cargarLibros, cargarPrestamos]);

  const etiquetasDisponibles = useMemo(() => {
    const conjunto = new Set();

    libros.forEach((libro) =>
      obtenerEtiquetas(libro).forEach((etiqueta) =>
        conjunto.add(etiqueta),
      ),
    );

    return [...conjunto].sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  }, [libros]);

  const librosFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda);

    const resultado = libros.filter((libro) => {
      const etiquetas = obtenerEtiquetas(libro);

      const textoLibro = normalizarTexto(
        [
          libro.titulo,
          libro.autor,
          libro.descripcion,
          libro.isbn,
          ...etiquetas,
        ].join(" "),
      );

      const coincideBusqueda =
        !termino || textoLibro.includes(termino);

      const coincideTipo =
        tipoSeleccionado === "todos" ||
        (libro.tipo_recurso || "").toLowerCase() ===
          tipoSeleccionado;

      const coincideEtiqueta =
        etiquetaSeleccionada === "todas" ||
        etiquetas.includes(etiquetaSeleccionada);

      return (
        coincideBusqueda &&
        coincideTipo &&
        coincideEtiqueta
      );
    });

    switch (orden) {
      case "titulo":
        resultado.sort((a, b) =>
          (a.titulo ?? "").localeCompare(
            b.titulo ?? "",
            "es",
          ),
        );
        break;

      case "autor":
        resultado.sort((a, b) =>
          (a.autor ?? "").localeCompare(
            b.autor ?? "",
            "es",
          ),
        );
        break;

      case "antiguos":
        resultado.sort(
          (a, b) =>
            new Date(a.fecha_ingreso || 0) -
            new Date(b.fecha_ingreso || 0),
        );
        break;

      case "disponibles":
        resultado.sort(
          (a, b) =>
            Number(b.existencias_disponibles ?? 0) -
            Number(a.existencias_disponibles ?? 0),
        );
        break;

      default:
        resultado.sort(
          (a, b) =>
            new Date(b.fecha_ingreso || 0) -
            new Date(a.fecha_ingreso || 0),
        );
    }

    return resultado;
  }, [
    libros,
    busqueda,
    tipoSeleccionado,
    etiquetaSeleccionada,
    orden,
  ]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(librosFiltrados.length / POR_PAGINA),
  );

  const librosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * POR_PAGINA;
    return librosFiltrados.slice(
      inicio,
      inicio + POR_PAGINA,
    );
  }, [librosFiltrados, pagina]);

  useEffect(() => {
    setPagina((actual) => Math.min(actual, totalPaginas));
  }, [totalPaginas]);

  const totalLibros = libros.length;

  const totalPdf = libros.filter(
    (libro) =>
      (libro.tipo_recurso || "").toLowerCase() === "pdf",
  ).length;

  const totalEpub = libros.filter(
    (libro) =>
      (libro.tipo_recurso || "").toLowerCase() === "epub",
  ).length;

  function limpiarFiltros() {
    setBusqueda("");
    setTipoSeleccionado("todos");
    setEtiquetaSeleccionada("todas");
    setOrden("recientes");
    setPagina(1);
    setError("");
  }

  function renderPortada(libro) {
    const url = libro.portadaFirmada;

    if (!url) {
      return (
        <div className="catalogo-portada-placeholder">
          <span aria-hidden="true">
            {(libro.tipo_recurso || "").toLowerCase() === "epub"
              ? "📱"
              : "📄"}
          </span>
          <span>
            {libro.tipo_recurso?.toUpperCase() || "LIBRO"}
          </span>
        </div>
      );
    }

    return (
      <img
        className="catalogo-portada"
        src={url}
        alt={`Portada de ${libro.titulo}`}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";

          const contenedor = e.currentTarget.parentElement;

          if (
            contenedor &&
            !contenedor.querySelector(
              ".catalogo-portada-placeholder",
            )
          ) {
            const marcador = document.createElement("div");
            marcador.className =
              "catalogo-portada-placeholder";

            const icono = document.createElement("span");
            icono.textContent = "📚";

            const texto = document.createElement("span");
            texto.textContent = "Portada no disponible";

            marcador.append(icono, texto);
            contenedor.appendChild(marcador);
          }
        }}
      />
    );
  }

  function renderAccionesLibro(libro, enModal = false) {
    const tienePrestamo = idsPrestados.has(libro.id);
    const procesando = operacionPrestamo === libro.id;

    return (
      <div
        className={
          enModal
            ? "catalogo-modal-acciones"
            : "catalogo-acciones"
        }
      >
        <button
          type="button"
          className="catalogo-btn-detalles"
          onClick={() =>
            setLibroSeleccionado(enModal ? null : libro)
          }
        >
          {enModal ? "Volver al catálogo" : "Ver detalles"}
        </button>

        {tienePrestamo ? (
          <button
            type="button"
            className="catalogo-btn-leer"
            onClick={() => abrirVisor(libro)}
          >
            Leer ahora
          </button>
        ) : (
          <button
            type="button"
            className="catalogo-btn-leer"
            disabled={
              procesando ||
              operacionPrestamo !== null ||
              cuposDisponibles === 0
            }
            onClick={() => prestarLibro(libro)}
          >
            {procesando
              ? "Procesando…"
              : cuposDisponibles === 0
                ? "Límite de 5 libros"
                : "Prestar libro"}
          </button>
        )}
      </div>
    );
  }

  return (
    <main className="catalogo-container">
      <header className="catalogo-encabezado">
        <div>
          <h1>Biblioteca Digital</h1>
          <p>
            Pide prestados libros digitales durante 7 días.
            Puedes devolverlos cuando quieras.
          </p>
        </div>

        <div className="catalogo-encabezado-acciones">
          <button
            type="button"
            className="catalogo-btn-actualizar"
            onClick={() => {
              cargarLibros(true);
              cargarPrestamos(true);
            }}
            disabled={cargando || cerrandoSesion}
          >
            {cargando
              ? "Actualizando…"
              : "↻ Actualizar catálogo"}
          </button>

    
        </div>
      </header>

      <section className="catalogo-estadisticas">
        <article className="catalogo-estadistica">
          <span className="catalogo-estadistica-icono">📚</span>
          <div>
            <span className="catalogo-estadistica-label">
              Libros registrados
            </span>
            <strong>{totalLibros}</strong>
          </div>
        </article>

        <article className="catalogo-estadistica">
          <span className="catalogo-estadistica-icono">📖</span>
          <div>
            <span className="catalogo-estadistica-label">
              Mis préstamos activos
            </span>
            <strong>{prestamosActivos.length} / 5</strong>
          </div>
        </article>

        <article className="catalogo-estadistica">
          <span className="catalogo-estadistica-icono">✅</span>
          <div>
            <span className="catalogo-estadistica-label">
              Cupos disponibles
            </span>
            <strong>{cuposDisponibles}</strong>
          </div>
        </article>

        <article className="catalogo-estadistica">
          <span className="catalogo-estadistica-icono">📄</span>
          <div>
            <span className="catalogo-estadistica-label">
              Documentos PDF / EPUB
            </span>
            <strong>{totalPdf} / {totalEpub}</strong>
          </div>
        </article>
      </section>

      <section className="catalogo-filtros">
        <div className="catalogo-busqueda">
          <label htmlFor="buscar-libro">Buscar libros</label>
          <input
            id="buscar-libro"
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Título, autor, ISBN o etiqueta…"
          />
        </div>

        <div className="catalogo-filtro">
          <label htmlFor="filtro-tipo">Formato</label>
          <select
            id="filtro-tipo"
            value={tipoSeleccionado}
            onChange={(e) => {
              setTipoSeleccionado(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todos">Todos los formatos</option>
            <option value="pdf">PDF</option>
            <option value="epub">EPUB</option>
          </select>
        </div>

        <div className="catalogo-filtro">
          <label htmlFor="filtro-etiqueta">Etiqueta</label>
          <select
            id="filtro-etiqueta"
            value={etiquetaSeleccionada}
            onChange={(e) => {
              setEtiquetaSeleccionada(e.target.value);
              setPagina(1);
            }}
          >
            <option value="todas">Todas las etiquetas</option>
            {etiquetasDisponibles.map((etiqueta) => (
              <option key={etiqueta} value={etiqueta}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="catalogo-filtro">
          <label htmlFor="orden-catalogo">Ordenar por</label>
          <select
            id="orden-catalogo"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="titulo">Título</option>
            <option value="autor">Autor</option>
            <option value="disponibles">
              Más existencias disponibles
            </option>
          </select>
        </div>

        <button
          type="button"
          className="catalogo-btn-limpiar"
          onClick={limpiarFiltros}
        >
          Limpiar filtros
        </button>
      </section>

      {error && (
        <div className="catalogo-mensaje-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Cerrar mensaje"
          >
            ✕
          </button>
        </div>
      )}

      {actualizado && !cargando && (
        <p className="catalogo-actualizacion">
          Última actualización:{" "}
          {actualizado.toLocaleTimeString("es-BO")}
        </p>
      )}

      {cargando && libros.length === 0 ? (
        <div className="catalogo-estado">
          <p>Cargando catálogo…</p>
        </div>
      ) : librosFiltrados.length === 0 ? (
        <div className="catalogo-estado">
          <h2>No se encontraron libros</h2>
          <p>Prueba con otro término o modifica los filtros.</p>
          <button
            type="button"
            className="catalogo-btn-leer"
            onClick={limpiarFiltros}
          >
            Mostrar todo el catálogo
          </button>
        </div>
      ) : (
        <>
          <section
            className="catalogo-grid"
            aria-label="Catálogo de libros"
          >
            {librosPaginados.map((libro) => (
              <article className="catalogo-libro" key={libro.id}>
                <button
                  type="button"
                  className="catalogo-portada-boton"
                  onClick={() => setLibroSeleccionado(libro)}
                  aria-label={`Ver detalles de ${libro.titulo}`}
                >
                  {renderPortada(libro)}
                </button>

                <div className="catalogo-libro-contenido">
                  <span className="catalogo-formato">
                    {libro.tipo_recurso?.toUpperCase()}
                  </span>

                  <h2>{libro.titulo}</h2>
                  <p className="catalogo-autor">{libro.autor}</p>

                  <p className="catalogo-fecha">
                    Ingreso: {formatearFecha(libro.fecha_ingreso)}
                  </p>

                  <div className="catalogo-etiquetas">
                    {obtenerEtiquetas(libro)
                      .slice(0, 3)
                      .map((etiqueta) => (
                        <span
                          className="catalogo-etiqueta"
                          key={etiqueta}
                        >
                          {etiqueta}
                        </span>
                      ))}
                  </div>

                  {idsPrestados.has(libro.id) && (
                    <p
                      style={{
                        color: "#15803d",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Ya tienes este libro prestado
                    </p>
                  )}

                  {renderAccionesLibro(libro)}
                </div>
              </article>
            ))}
          </section>

          <nav
            className="catalogo-paginacion"
            aria-label="Paginación"
          >
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() =>
                setPagina((p) => Math.max(1, p - 1))
              }
            >
              ← Anterior
            </button>

            <span>
              Página <strong>{pagina}</strong> de{" "}
              <strong>{totalPaginas}</strong>
            </span>

            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() =>
                setPagina((p) =>
                  Math.min(totalPaginas, p + 1),
                )
              }
            >
              Siguiente →
            </button>
          </nav>
        </>
      )}

      {libroSeleccionado && (
        <div
          className="catalogo-modal-fondo"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setLibroSeleccionado(null);
            }
          }}
        >
          <section
            className="catalogo-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detalle-libro-titulo"
          >
            <button
              type="button"
              className="catalogo-modal-cerrar"
              onClick={() => setLibroSeleccionado(null)}
              aria-label="Cerrar detalles"
            >
              ✕
            </button>

            <div className="catalogo-modal-portada">
              {renderPortada(libroSeleccionado)}
            </div>

            <h2 id="detalle-libro-titulo">
              {libroSeleccionado.titulo}
            </h2>

            <p>
              <strong>Autor:</strong> {libroSeleccionado.autor}
            </p>
            <p>
              <strong>Formato:</strong>{" "}
              {libroSeleccionado.tipo_recurso?.toUpperCase()}
            </p>

            {libroSeleccionado.isbn && (
              <p>
                <strong>ISBN:</strong> {libroSeleccionado.isbn}
              </p>
            )}

            <p>
              <strong>Descripción:</strong>{" "}
              {libroSeleccionado.descripcion ||
                "No hay descripción registrada."}
            </p>

            <p>
              <strong>Ingreso:</strong>{" "}
              {formatearFecha(libroSeleccionado.fecha_ingreso)}
            </p>

            {obtenerEtiquetas(libroSeleccionado).length > 0 && (
              <div className="catalogo-etiquetas">
                {obtenerEtiquetas(libroSeleccionado).map(
                  (etiqueta) => (
                    <span
                      className="catalogo-etiqueta"
                      key={etiqueta}
                    >
                      {etiqueta}
                    </span>
                  ),
                )}
              </div>
            )}

            {renderAccionesLibro(libroSeleccionado, true)}
          </section>
        </div>
      )}
    </main>
  );
}
