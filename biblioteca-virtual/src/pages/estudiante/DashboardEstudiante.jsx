import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { supabase } from "../../lib/supabaseClient.js";
import VisorDocumento from "../../components/VisorDocumento.jsx";
import CatalogoLibrosEstudiante from "./CatalogoLibrosEstudiante.jsx";
import ColeccionesEstudiante from "./ColeccionesEstudiante.jsx";
import ExplorarColeccionesEstudiante from "./ExplorarColeccionesEstudiante.jsx";
import "../../styles/Estudiante/Catalogo.css";

const INTERVALO_ACTUALIZACION = 10000;
const DURACION_URL_PORTADA = 55 * 60 * 1000;
const VIGENCIA_URL_PORTADA = 60 * 60;
const ANCHO_SIDEBAR = 268;

const cachePortadas = new Map();

function formatearFechaHora(fecha) {
  if (!fecha) return "Sin fecha";

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) return "Sin fecha";

  return valor.toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        const ruta = url.pathname.slice(indice + segmento.length);

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
    return /^https?:\/\//i.test(valorLimpio) ? valorLimpio : null;
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

function obtenerMensajeError(error) {
  const mensaje = error?.message || "";

  if (mensaje.includes("Has alcanzado el límite")) {
    return "Ya tienes 5 libros prestados. Devuelve uno para pedir otro.";
  }

  if (mensaje.includes("Ya tienes este libro prestado")) {
    return "Ya tienes este libro en tus préstamos.";
  }

  if (mensaje.includes("No se encontró tu perfil")) {
    return "No se encontró tu perfil de estudiante.";
  }

  return mensaje || "Ocurrió un error. Inténtalo de nuevo.";
}

export default function DashboardEstudiante() {
  const [seccionActiva, setSeccionActiva] = useState("catalogo");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
const ELEMENTOS_POR_PAGINA = 10;

  // Estado del Modo Noche con persistencia
  const [modoNoche, setModoNoche] = useState(() => {
    if (typeof window !== "undefined") {
      const guardado = window.localStorage.getItem("bosque-theme");
      if (guardado) return guardado === "dark";
    }
    return false;
  });

  const [prestamos, setPrestamos] = useState([]);
  const [cargandoPrestamos, setCargandoPrestamos] = useState(false);
  const [operacionPrestamo, setOperacionPrestamo] = useState(null);

  const [libroEnLectura, setLibroEnLectura] = useState(null);
  const [error, setError] = useState("");

  const [esMovil, setEsMovil] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 900
  );

  useEffect(() => {
    const root = document.documentElement;
    if (modoNoche) {
      root.setAttribute("data-theme", "dark");
      window.localStorage.setItem("bosque-theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
      window.localStorage.setItem("bosque-theme", "light");
    }
  }, [modoNoche]);

  const prestamosActivos = useMemo(
    () => prestamos.filter((prestamo) => !prestamo.devuelto_en),
    [prestamos]
  );

  const prestamosDevueltos = useMemo(
    () => prestamos.filter((prestamo) => Boolean(prestamo.devuelto_en)),
    [prestamos]
  );

  const prestamosPorVencer = useMemo(() => {
    const limite = Date.now() + 48 * 60 * 60 * 1000; // Próximas 48 hrs o vencidos
    return prestamosActivos.filter(
      (p) => p.vence_en && new Date(p.vence_en).getTime() <= limite
    );
  }, [prestamosActivos]);

  const cuposDisponibles = Math.max(0, 5 - prestamosActivos.length);

  const idsPrestados = useMemo(
    () => new Set(prestamosActivos.map((p) => p.recurso_id)),
    [prestamosActivos]
  );
  const totalPaginasHistorial = Math.ceil(
  prestamosDevueltos.length / ELEMENTOS_POR_PAGINA
) || 1;

const historialPaginado = useMemo(() => {
  const inicio = (paginaHistorial - 1) * ELEMENTOS_POR_PAGINA;
  return prestamosDevueltos.slice(inicio, inicio + ELEMENTOS_POR_PAGINA);
}, [prestamosDevueltos, paginaHistorial]);

  useEffect(() => {
    const actualizarDispositivo = () => {
      setEsMovil(window.innerWidth <= 900);
    };

    actualizarDispositivo();
    window.addEventListener("resize", actualizarDispositivo);

    return () => window.removeEventListener("resize", actualizarDispositivo);
  }, []);

  // ---------------------------------------------------------
  // PRÉSTAMOS
  // ---------------------------------------------------------

  const cargarPrestamos = useCallback(async (mostrarCarga = false) => {
    if (mostrarCarga) setCargandoPrestamos(true);

    try {
      const { data: registros, error: errorPrestamos } = await supabase
        .from("prestamos_libros")
        .select("id, recurso_id, prestado_en, vence_en, devuelto_en")
        .order("prestado_en", { ascending: false });

      if (errorPrestamos) throw errorPrestamos;

      const lista = registros ?? [];
      const ids = [...new Set(lista.map((p) => p.recurso_id))];

      let recursos = [];

      if (ids.length > 0) {
        const { data, error: errorRecursos } = await supabase
          .from("recursos_bibliograficos")
          .select("id, titulo, autor, tipo_recurso, portada_url, archivo_url")
          .in("id", ids);

        if (errorRecursos) throw errorRecursos;

        recursos = data ?? [];
      }

      const recursosPorId = new Map(
        recursos.map((recurso) => [recurso.id, recurso])
      );

      const resultado = await Promise.all(
        lista.map(async (prestamo) => {
          const recurso = recursosPorId.get(prestamo.recurso_id);

          return {
            ...prestamo,
            libro: recurso
              ? {
                  ...recurso,
                  portadaFirmada: await obtenerPortadaFirmada(
                    recurso.portada_url
                  ),
                }
              : null,
          };
        })
      );

      setPrestamos(resultado);
    } catch (err) {
      console.error("[PRESTAMOS]", err);

      toast.error(
        "No se pudieron cargar tus préstamos: " + obtenerMensajeError(err)
      );
    } finally {
      setCargandoPrestamos(false);
    }
  }, []);

  useEffect(() => {
    cargarPrestamos(true);

    const intervalo = window.setInterval(() => {
      cargarPrestamos(false);
    }, INTERVALO_ACTUALIZACION);

    return () => window.clearInterval(intervalo);
  }, [cargarPrestamos]);

  const prestarLibro = useCallback(
    async (libro) => {
      if (operacionPrestamo) return;

      if (idsPrestados.has(libro.id)) {
        toast("Ya tienes este libro prestado.");
        return;
      }

      if (prestamosActivos.length >= 5) {
        toast.error(
          "Ya tienes 5 libros prestados. Devuelve uno para liberar un cupo."
        );
        return;
      }

      setOperacionPrestamo(libro.id);

      try {
        const { data, error: errorRpc } = await supabase.rpc(
          "prestarse_libro",
          { p_recurso_id: libro.id }
        );

        if (errorRpc) throw errorRpc;

        if (data?.ok === false) {
          throw new Error(data.mensaje || "No se pudo prestar el libro.");
        }

        toast.success("Libro prestado por 7 días.");
        await cargarPrestamos(true);
      } catch (err) {
        console.error("[PRESTAR LIBRO]", err);
        toast.error(obtenerMensajeError(err));
        await cargarPrestamos(false);
      } finally {
        setOperacionPrestamo(null);
      }
    },
    [operacionPrestamo, idsPrestados, prestamosActivos.length, cargarPrestamos]
  );

  const devolverLibro = useCallback(
    async (prestamo) => {
      if (operacionPrestamo) return;

      setOperacionPrestamo(prestamo.id);

      try {
        const { data, error: errorRpc } = await supabase.rpc("devolver_libro", {
          p_prestamo_id: prestamo.id,
        });

        if (errorRpc) throw errorRpc;

        if (data?.ok === false) {
          throw new Error(data.mensaje || "No se pudo devolver el libro.");
        }

        if (libroEnLectura?.id === prestamo.recurso_id) {
          setLibroEnLectura(null);
        }

        toast.success("Libro devuelto. Ya tienes un cupo disponible.");

        await cargarPrestamos(true);
      } catch (err) {
        console.error("[DEVOLVER LIBRO]", err);
        toast.error(obtenerMensajeError(err));
        await cargarPrestamos(false);
      } finally {
        setOperacionPrestamo(null);
      }
    },
    [operacionPrestamo, libroEnLectura, cargarPrestamos]
  );

  // ---------------------------------------------------------
  // LECTOR
  // ---------------------------------------------------------

  const abrirVisor = useCallback(
    async (libro) => {
      const formato = (libro.tipo_recurso || "").toLowerCase();

      if (!["pdf", "epub"].includes(formato)) {
        toast.error("Este formato de documento no es compatible.");
        return;
      }

      if (!libro.archivo_url) {
        toast.error("Este libro no tiene un archivo asociado.");
        return;
      }

      if (!idsPrestados.has(libro.id)) {
        toast.error("Primero debes prestarte este libro.");
        return;
      }

      const { data, error: errorVerificacion } = await supabase.rpc(
        "tiene_prestamo_activo",
        {
          p_recurso_id: libro.id,
        }
      );

      if (errorVerificacion) {
        console.error("[VERIFICAR PRÉSTAMO]", errorVerificacion);
        toast.error("No se pudo verificar tu préstamo.");
        return;
      }

      if (!data) {
        await cargarPrestamos(false);
        toast.error("Este libro ya no tiene un préstamo activo.");
        return;
      }

      setError("");
      setLibroEnLectura(libro);
    },
    [idsPrestados, cargarPrestamos]
  );

  const cerrarVisor = useCallback(() => {
    setLibroEnLectura(null);
    cargarPrestamos(false);
  }, [cargarPrestamos]);

  // ---------------------------------------------------------
  // SESIÓN Y NAVEGACIÓN
  // ---------------------------------------------------------

  const cerrarSesion = useCallback(async () => {
    if (cerrandoSesion) return;

    setCerrandoSesion(true);
    setError("");

    try {
      const { error: errorSesion } = await supabase.auth.signOut({
        scope: "local",
      });

      if (errorSesion) throw errorSesion;

      window.location.reload();
    } catch (err) {
      console.error("[AUTH]", err);

      setError(err?.message || "No se pudo cerrar la sesión.");

      setCerrandoSesion(false);
    }
  }, [cerrandoSesion]);

  function navegarA(seccion) {
    setSeccionActiva(seccion);
    setMenuAbierto(false);
    setError("");

    if (seccion !== "catalogo") {
      setLibroEnLectura(null);
    }

    if (seccion === "prestamos") {
      cargarPrestamos(true);
    }
  }

  function renderPortada(libro) {
    const url = libro?.portadaFirmada;

    if (!url) {
      return (
        <div className="catalogo-portada-placeholder">
          <span>
            {libro?.tipo_recurso?.toLowerCase() === "epub" ? "📱" : "📗"}
          </span>
          <span>{libro?.tipo_recurso?.toUpperCase() || "LIBRO"}</span>
        </div>
      );
    }

    return (
      <img
        className="catalogo-portada"
        src={url}
        alt={`Portada de ${libro?.titulo || "libro"}`}
        loading="lazy"
      />
    );
  }

  // ---------------------------------------------------------
  // INTERFAZ DEL DASHBOARD
  // ---------------------------------------------------------

  const porcentajeCupos = Math.min(100, (prestamosActivos.length / 5) * 100);

  return (
    <div
      className={`estudiante-layout ${modoNoche ? "theme-dark" : "theme-light"}`}
      style={{ minHeight: "100vh", width: "100%" }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: modoNoche ? "#132a23" : "#ffffff",
            color: modoNoche ? "#f1f5f9" : "#122620",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "14px",
          },
        }}
      />

      <button
        type="button"
        className="estudiante-menu-toggle"
        onClick={() => setMenuAbierto((abierto) => !abierto)}
        aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuAbierto}
      >
        {menuAbierto ? "✕" : "☰"}
      </button>

      {menuAbierto && (
        <button
          type="button"
          className="estudiante-sidebar-overlay"
          onClick={() => setMenuAbierto(false)}
          aria-label="Cerrar menú lateral"
        />
      )}

      {/* SIDEBAR ESTILO BOSQUE DEL SABER */}
      <aside
        className={`estudiante-sidebar ${
          menuAbierto ? "estudiante-sidebar-abierto" : ""
        }`}
      >
        <div className="estudiante-sidebar-marca">
          <span className="estudiante-sidebar-logo">🌲</span>
          <div>
            <strong>UMSS</strong>
            <span>BOSQUE DEL SABER</span>
          </div>
        </div>

        <nav
          className="estudiante-sidebar-nav"
          aria-label="Menú principal del estudiante"
        >
          <span className="estudiante-sidebar-titulo">SANTUARIO</span>

          <button
            type="button"
            className={`estudiante-sidebar-link ${
              seccionActiva === "catalogo" ? "activo" : ""
            }`}
            onClick={() => navegarA("catalogo")}
          >
            <span aria-hidden="true">📖</span>
            <span>Catálogo de Libros</span>
          </button>

          <button
            type="button"
            className={`estudiante-sidebar-link ${
              seccionActiva === "prestamos" ? "activo" : ""
            }`}
            onClick={() => navegarA("prestamos")}
          >
            <span aria-hidden="true">🌿</span>
            <span>Mis Préstamos</span>
            <span className="estudiante-sidebar-badge">
              {prestamosActivos.length}/5
            </span>
          </button>

          <span className="estudiante-sidebar-titulo">COLECCIONES</span>

          <button
            type="button"
            className={`estudiante-sidebar-link ${
              seccionActiva === "explorar-colecciones" ? "activo" : ""
            }`}
            onClick={() => navegarA("explorar-colecciones")}
          >
            <span aria-hidden="true">🧭</span>
            <span>Explorar Colecciones</span>
          </button>

          <button
            type="button"
            className={`estudiante-sidebar-link ${
              seccionActiva === "colecciones" ? "activo" : ""
            }`}
            onClick={() => navegarA("colecciones")}
          >
            <span aria-hidden="true">🗂️</span>
            <span>Mis Colecciones</span>
          </button>
        </nav>

        <div className="estudiante-sidebar-pie">
          <button
            type="button"
            className="estudiante-sidebar-link estudiante-sidebar-tema"
            onClick={() => setModoNoche((prev) => !prev)}
            aria-label="Alternar modo noche"
          >
            <span aria-hidden="true">{modoNoche ? "☀️" : "🌙"}</span>
            <span>{modoNoche ? "Modo Día" : "Modo Noche"}</span>
            <span className="tema-indicador-pill">
              {modoNoche ? "ON" : "OFF"}
            </span>
          </button>

          <button
            type="button"
            className="estudiante-sidebar-link estudiante-sidebar-salir"
            onClick={cerrarSesion}
            disabled={cerrandoSesion}
          >
            <span aria-hidden="true">↪</span>
            <span>
              {cerrandoSesion ? "Cerrando sesión…" : "Cerrar sesión"}
            </span>
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div
        className="estudiante-main"
        style={{
          boxSizing: "border-box",
          width: esMovil ? "100%" : `calc(100% - ${ANCHO_SIDEBAR}px)`,
          marginLeft: esMovil ? 0 : `${ANCHO_SIDEBAR}px`,
          minWidth: 0,
          minHeight: "100vh",
          paddingTop: esMovil ? "70px" : undefined,
        }}
      >
        {/* TOPBAR SUTIL ESTILO MOCKUP */}
        <header className="bosque-topbar">
          <div className="bosque-topbar-left">
            <span className="bosque-topbar-tag">
              🌱 Biblioteca Universitaria Digital
            </span>
            <span className="bosque-topbar-divider">•</span>
            <span className="bosque-topbar-section">
              {seccionActiva === "catalogo" && "Catálogo General"}
              {seccionActiva === "prestamos" && "Mis Préstamos y Lecturas"}
              {seccionActiva === "explorar-colecciones" &&
                "Explorar Colecciones"}
              {seccionActiva === "colecciones" && "Herbario y Colecciones"}
            </span>
          </div>

          <div className="bosque-topbar-actions">
            <button
              type="button"
              className="bosque-topbar-pill"
              onClick={() => navegarA("prestamos")}
              title="Ver mis préstamos activos"
            >
              <span>📚</span>
              <strong>{prestamosActivos.length}/5</strong>
              <span>activos</span>
            </button>

            <button
              type="button"
              className="bosque-topbar-icon-btn"
              onClick={() => setModoNoche((prev) => !prev)}
              title={modoNoche ? "Cambiar a modo claro" : "Cambiar a modo noche"}
              aria-label="Cambiar tema"
            >
              {modoNoche ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        {error && (
          <div
            className="catalogo-mensaje-error"
            role="alert"
            style={{ margin: "0 0 20px 0" }}
          >
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

        {/* CATÁLOGO INDEPENDIENTE */}
        {seccionActiva === "catalogo" && (
          <CatalogoLibrosEstudiante
            idsPrestados={idsPrestados}
            prestamosActivos={prestamosActivos}
            cuposDisponibles={cuposDisponibles}
            operacionPrestamo={operacionPrestamo}
            prestarLibro={prestarLibro}
            abrirVisor={abrirVisor}
            cargarPrestamos={cargarPrestamos}
            cerrarSesion={cerrarSesion}
            cerrandoSesion={cerrandoSesion}
          />
        )}

        {/* MIS PRÉSTAMOS (DISEÑO MOCKUP "BOSQUE DEL SABER") */}
        {seccionActiva === "prestamos" && (
          <main className="catalogo-container bosque-prestamos-view">
            {/* HERO BANNER DEL MOCKUP */}
            <section className="bosque-hero">
              <div className="bosque-hero-content">
                <span className="bosque-hero-badge">
                  🌿 BOSQUE ACADÉMICO CENTRAL • PANEL PERSONAL
                </span>
                <h1>Bienvenido de vuelta, explorador del saber.</h1>
                <p>
                  El follaje de la biblioteca susurra nuevos descubrimientos
                  hoy. Tienes{" "}
                  <strong>
                    {prestamosActivos.length}{" "}
                    {prestamosActivos.length === 1
                      ? "lectura activa"
                      : "lecturas activas"}
                  </strong>{" "}
                  y <strong>{cuposDisponibles} cupos disponibles</strong> para
                  seguir explorando.
                </p>

                <div className="bosque-hero-meta">
                  <span className="bosque-hero-pill">
                    ● Lector Universitario Activo
                  </span>
                  <span className="bosque-hero-matricula">
                    ⏳ Préstamos de 7 días con devolución inmediata
                  </span>
                </div>
              </div>

              <div className="bosque-hero-illustration" aria-hidden="true">
                <div className="bosque-hero-art-card">
                  <div className="bosque-art-emoji">🌳📖✨</div>
                  <p>Santuario de Lectura</p>
                  <span className="bosque-art-badge">📍 Cúpula Digital UMSS</span>
                </div>
              </div>
            </section>

            {/* 3 TARJETAS BENTO DE ESTADÍSTICAS */}
            <section className="bosque-stats-grid">
              <article className="bosque-stat-card">
                <div className="bosque-stat-top">
                  <span className="bosque-stat-icon mint">📖</span>
                  <span className="bosque-stat-tag">Lecturas Activas</span>
                </div>
                <div className="bosque-stat-number">
                  <strong>{prestamosActivos.length}</strong>
                  <span>volúmenes en curso</span>
                </div>
                <p className="bosque-stat-desc">
                  Puedes tener hasta 5 libros digitales simultáneos en tu
                  estantería.
                </p>
                <div className="bosque-stat-progress">
                  <div
                    className="bosque-stat-progress-bar mint"
                    style={{ width: `${porcentajeCupos}%` }}
                  />
                </div>
                <div className="bosque-stat-footer">
                  <span>Capacidad utilizada</span>
                  <strong>{Math.round(porcentajeCupos)}%</strong>
                </div>
              </article>

              <article className="bosque-stat-card">
                <div className="bosque-stat-top">
                  <span className="bosque-stat-icon amber">⏳</span>
                  <span className="bosque-stat-tag amber">
                    Próximo a Vencer
                  </span>
                </div>
                <div className="bosque-stat-number">
                  <strong>{prestamosPorVencer.length}</strong>
                  <span>
                    {prestamosPorVencer.length === 1
                      ? "préstamo por vencer"
                      : "préstamos por vencer"}
                  </span>
                </div>
                <p className="bosque-stat-desc">
                  {prestamosPorVencer.length > 0
                    ? "Revisa las fechas límite para devolver a tiempo en el santuario."
                    : "Todos tus libros están dentro del plazo de lectura."}
                </p>
                <div className="bosque-stat-progress">
                  <div
                    className="bosque-stat-progress-bar amber"
                    style={{
                      width:
                        prestamosPorVencer.length > 0 ? "75%" : "12%",
                    }}
                  />
                </div>
                <div className="bosque-stat-footer">
                  <span>Vigencia estándar: 7 días</span>
                  <button
                    type="button"
                    className="bosque-stat-link"
                    onClick={() => cargarPrestamos(true)}
                    disabled={cargandoPrestamos}
                  >
                    {cargandoPrestamos ? "Sincronizando…" : "↻ Sincronizar"}
                  </button>
                </div>
              </article>

              <article className="bosque-stat-card">
                <div className="bosque-stat-top">
                  <span className="bosque-stat-icon green">🌱</span>
                  <span className="bosque-stat-tag">Estante Personal</span>
                </div>
                <div className="bosque-stat-number">
                  <strong>{cuposDisponibles}</strong>
                  <span>cupos disponibles</span>
                </div>
                <p className="bosque-stat-desc">
                  Además, has completado{" "}
                  <strong>{prestamosDevueltos.length}</strong> devoluciones en
                  tu historial.
                </p>
                <div className="bosque-stat-progress">
                  <div
                    className="bosque-stat-progress-bar green"
                    style={{ width: `${(cuposDisponibles / 5) * 100}%` }}
                  />
                </div>
                <div className="bosque-stat-footer">
                  <span>Disponibilidad inmediata</span>
                  <button
                    type="button"
                    className="bosque-stat-link"
                    onClick={() => navegarA("catalogo")}
                  >
                    Explorar más →
                  </button>
                </div>
              </article>
            </section>

            {/* LAYOUT DE 2 COLUMNAS: LECTURAS EN CURSO + RUTAS DEL BOSQUE */}
            <div className="bosque-content-split">
              {/* COLUMNA PRINCIPAL: TARJETAS HORIZONTALES DE PRÉSTAMOS */}
              <section
                className="bosque-loans-section"
                aria-label="Mis préstamos activos"
              >
                <div className="bosque-section-header">
                  <div>
                    <h2>Lecturas y Préstamos en Curso</h2>
                    <p>
                      Documentos digitales custodiados bajo tu registro de
                      estudiante.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="catalogo-btn-actualizar"
                    onClick={() => cargarPrestamos(true)}
                    disabled={cargandoPrestamos}
                  >
                    {cargandoPrestamos ? "Actualizando…" : "↻ Actualizar"}
                  </button>
                </div>

                {cargandoPrestamos && prestamos.length === 0 ? (
                  <div className="catalogo-estado">
                    <p>Cargando tus préstamos del bosque…</p>
                  </div>
                ) : prestamosActivos.length === 0 ? (
                  <div className="catalogo-estado bosque-empty-state">
                    <span className="bosque-empty-icon">🍃</span>
                    <h2>Tu estantería de préstamos está libre</h2>
                    <p>
                      Puedes pedir hasta 5 libros simultáneamente desde el
                      catálogo digital y leerlos al instante.
                    </p>
                    <button
                      type="button"
                      className="catalogo-btn-leer"
                      onClick={() => navegarA("catalogo")}
                    >
                      Explorar catálogo de libros
                    </button>
                  </div>
                ) : (
                  <div className="bosque-loans-list">
                    {prestamosActivos.map((prestamo) => {
                      const libro = prestamo.libro;
                      const vencido =
                        new Date(prestamo.vence_en) < new Date();
                      const procesando = operacionPrestamo === prestamo.id;

                      return (
                        <article
                          className="bosque-loan-card"
                          key={prestamo.id}
                        >
                          <div className="bosque-loan-cover">
                            {libro ? (
                              renderPortada(libro)
                            ) : (
                              <div className="catalogo-portada-placeholder">
                                <span>📚</span>
                                <span>Libro</span>
                              </div>
                            )}
                          </div>

                          <div className="bosque-loan-body">
                            <div className="bosque-loan-top">
                              <span className="catalogo-formato">
                                {libro?.tipo_recurso?.toUpperCase() ||
                                  "RECURSO DIGITAL"}{" "}
                                • BIBLIOTECA UMSS
                              </span>

                              <span
                                className={`bosque-status-pill ${
                                  vencido ? "vencido" : "activo"
                                }`}
                              >
                                {vencido
                                  ? "⚠️ Préstamo vencido"
                                  : "● Al día"}
                              </span>
                            </div>

                            <h3 className="bosque-loan-title">
                              {libro?.titulo || "Recurso no disponible"}
                            </h3>

                            <p className="bosque-loan-author">
                              {libro?.autor || "Autor institucional"}
                            </p>

                            <div className="bosque-loan-meta-box">
                              <div className="bosque-loan-dates">
                                <div>
                                  <span className="meta-label">
                                    📅 Prestado:
                                  </span>
                                  <strong>
                                    {formatearFechaHora(prestamo.prestado_en)}
                                  </strong>
                                </div>
                                <div>
                                  <span className="meta-label">
                                    ⏳ Devolución límite:
                                  </span>
                                  <strong
                                    className={
                                      vencido ? "texto-vencido" : ""
                                    }
                                  >
                                    {formatearFechaHora(prestamo.vence_en)}
                                  </strong>
                                </div>
                              </div>

                              <div className="bosque-loan-actions">
                                <button
                                  type="button"
                                  className="catalogo-btn-leer"
                                  disabled={!libro || !libro.archivo_url}
                                  onClick={() => libro && abrirVisor(libro)}
                                >
                                  📖 Leer libro
                                </button>

                                <button
                                  type="button"
                                  className="catalogo-btn-detalles"
                                  disabled={
                                    procesando || operacionPrestamo !== null
                                  }
                                  onClick={() => devolverLibro(prestamo)}
                                >
                                  {procesando
                                    ? "Devolviendo…"
                                    : "Devolver libro"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* COLUMNA LATERAL DERECHA: RUTAS DEL BOSQUE */}
              <aside className="bosque-side-panel">
                <div className="bosque-routes-card">
                  <h3>Rutas del Bosque</h3>
                  <p>
                    Accesos inmediatos del campus digital para tu jornada de
                    investigación.
                  </p>

                  <div className="bosque-routes-list">
                    <button
                      type="button"
                      className="bosque-route-item"
                      onClick={() => navegarA("catalogo")}
                    >
                      <span className="bosque-route-icon">📚</span>
                      <div className="bosque-route-text">
                        <strong>Catálogo Cúpula UMSS</strong>
                        <span>Explorar libros PDF y EPUB</span>
                      </div>
                      <span className="bosque-route-arrow">›</span>
                    </button>

                    <button
                      type="button"
                      className="bosque-route-item"
                      onClick={() => navegarA("explorar-colecciones")}
                    >
                      <span className="bosque-route-icon">🧭</span>
                      <div className="bosque-route-text">
                        <strong>Explorar Colecciones</strong>
                        <span>Rutas temáticas de estudio</span>
                      </div>
                      <span className="bosque-route-arrow">›</span>
                    </button>

                    <button
                      type="button"
                      className="bosque-route-item"
                      onClick={() => navegarA("colecciones")}
                    >
                      <span className="bosque-route-icon">🗂️</span>
                      <div className="bosque-route-text">
                        <strong>Mi Herbario Personal</strong>
                        <span>Tus colecciones guardadas</span>
                      </div>
                      <span className="bosque-route-arrow">›</span>
                    </button>

                    <button
                      type="button"
                      className="bosque-route-item"
                      onClick={() => cargarPrestamos(true)}
                    >
                      <span className="bosque-route-icon">🔄</span>
                      <div className="bosque-route-text">
                        <strong>Sincronización Rápida</strong>
                        <span>Actualizar estado de cupos</span>
                      </div>
                      <span className="bosque-route-arrow">›</span>
                    </button>
                  </div>
                </div>

                <div className="bosque-Santuario-card">
                  <div className="bosque-santuario-top">
                    <span>🌿 REGLAMENTO DEL SANTUARIO</span>
                    <span className="bosque-santuario-badge">Activo</span>
                  </div>
                  <h4>Préstamo Responsable</h4>
                  <p>
                    Cada ejemplar digital reservado permanece en tu cuenta por{" "}
                    <strong>7 días</strong>. Al devolverlo liberas tu cupo al
                    instante para otros estudiantes.
                  </p>
                </div>
              </aside>
            </div>

{/* HISTORIAL DE DEVOLUCIONES PAGINADO */}
<section className="bosque-history-section">
  <div className="bosque-section-header">
    <div>
      <h2>Historial de devoluciones</h2>
      <p>
        Registro de lecturas finalizadas (mostrando {historialPaginado.length} de {prestamosDevueltos.length} registros).
      </p>
    </div>
  </div>

  {prestamosDevueltos.length === 0 ? (
    <div className="bosque-history-empty">
      <p>Todavía no tienes devoluciones registradas.</p>
    </div>
  ) : (
    <>
      <div className="bosque-table-wrapper">
        <table className="bosque-table">
          <thead>
            <tr>
              <th>Libro / Recurso</th>
              <th>Fecha de Préstamo</th>
              <th>Fecha de Devolución</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            {historialPaginado.map((prestamo) => (
              <tr key={prestamo.id}>
                <td>
                  <div className="bosque-table-book">
                    <strong>{prestamo.libro?.titulo || "Libro"}</strong>
                    {prestamo.libro?.autor && (
                      <span>{prestamo.libro.autor}</span>
                    )}
                  </div>
                </td>
                <td>{formatearFechaHora(prestamo.prestado_en)}</td>
                <td>{formatearFechaHora(prestamo.devuelto_en)}</td>
                <td>
                  <span className="bosque-status-pill devuelto">
                    ✓ Devuelto
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CONTROLES DE PAGINACIÓN DINÁMICA */}
      {totalPaginasHistorial > 1 && (
        <div className="bosque-historial-paginacion">
          <span className="bosque-paginacion-info">
            Página <strong>{paginaHistorial}</strong> de{" "}
            <strong>{totalPaginasHistorial}</strong>
          </span>

          <div className="bosque-paginacion-botones">
            <button
              type="button"
              className="bosque-btn-pag"
              onClick={() => setPaginaHistorial((prev) => Math.max(1, prev - 1))}
              disabled={paginaHistorial === 1}
            >
              ‹ Anterior
            </button>

            {Array.from({ length: totalPaginasHistorial }, (_, i) => i + 1).map(
              (num) => (
                <button
                  key={num}
                  type="button"
                  className={`bosque-btn-pag-num ${
                    paginaHistorial === num ? "activo" : ""
                  }`}
                  onClick={() => setPaginaHistorial(num)}
                >
                  {num}
                </button>
              )
            )}

            <button
              type="button"
              className="bosque-btn-pag"
              onClick={() =>
                setPaginaHistorial((prev) =>
                  Math.min(totalPaginasHistorial, prev + 1)
                )
              }
              disabled={paginaHistorial === totalPaginasHistorial}
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
        )}

        {/* EXPLORAR COLECCIONES */}
        {seccionActiva === "explorar-colecciones" && (
          <section className="estudiante-colecciones">
            <ExplorarColeccionesEstudiante />
          </section>
        )}

        {/* MIS COLECCIONES */}
        {seccionActiva === "colecciones" && (
          <section className="estudiante-colecciones">
            <ColeccionesEstudiante />
          </section>
        )}

        {/* VISOR DE DOCUMENTOS */}
        {libroEnLectura && (
          <VisorDocumento libro={libroEnLectura} onCerrar={cerrarVisor} />
        )}
      </div>
    </div>
  );
}