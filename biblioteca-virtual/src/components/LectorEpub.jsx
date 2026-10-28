import { useEffect, useRef, useState, useCallback } from "react";
import ePub from "epubjs";
import "../styles/Estudiante/LectorEpub.css";

export default function LectorEpub({ archivo, titulo = "Libro EPUB" }) {
  const contenedorVisorRef = useRef(null);
  const libroInstanciaRef = useRef(null);
  const renditionRef = useRef(null);

  // Evita usar valores antiguos dentro de los efectos.
  const temaRef = useRef("sepia");
  const tamanoFuenteRef = useRef(100);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [capitulos, setCapitulos] = useState([]);
  const [capituloActual, setCapituloActual] = useState("");
  const [tema, setTema] = useState("sepia");
  const [tamanoFuente, setTamanoFuente] = useState(100);
  const [modoFlujo, setModoFlujo] = useState("paginated");

  // Mantener actualizados los valores usados al inicializar el libro.
  temaRef.current = tema;
  tamanoFuenteRef.current = tamanoFuente;

  const aplicarEstilos = useCallback((rendition, temaSeleccionado, fuente) => {
    if (!rendition) return;

    const paletas = {
      claro: {
        fondo: "#ffffff",
        texto: "#1e293b",
      },
      sepia: {
        fondo: "#f4ecd8",
        texto: "#292524",
      },
      oscuro: {
        fondo: "#141e1b",
        texto: "#e2e8f0",
      },
    };

    const colores = paletas[temaSeleccionado] || paletas.sepia;

    rendition.themes.default({
      "html, body": {
        color: `${colores.texto} !important`,
        background: `${colores.fondo} !important`,
        "font-family": 'Georgia, "Times New Roman", serif !important',
        "line-height": "1.7 !important",
        margin: "0 !important",
      },

      body: {
        padding: "16px 28px !important",
        "box-sizing": "border-box !important",
      },

      "p, div, span, li, a, blockquote": {
        color: `${colores.texto} !important`,
        "line-height": "1.7 !important",
      },

      "h1, h2, h3, h4, h5, h6": {
        color: `${colores.texto} !important`,
      },

      "img, svg, video": {
        "max-width": "100% !important",
        "box-sizing": "border-box !important",
      },

      img: {
        height: "auto !important",
        display: "block !important",
        margin: "12px auto !important",
      },
    });

    rendition.themes.fontSize(`${fuente}%`);
  }, []);

  useEffect(() => {
    let cancelado = false;
    let libro = null;
    let rendition = null;
    let manejadorUbicacion = null;

    async function inicializarLibro() {
      setCargando(true);
      setError("");
      setCapitulos([]);
      setCapituloActual("");

      // Limpiar el visor anterior antes de cargar otro archivo.
      try {
        if (renditionRef.current) {
          renditionRef.current.destroy?.();
        }
      } catch (e) {
        console.warn("No se pudo limpiar la vista anterior:", e);
      }

      try {
        if (libroInstanciaRef.current) {
          libroInstanciaRef.current.destroy?.();
        }
      } catch (e) {
        console.warn("No se pudo destruir el libro anterior:", e);
      }

      renditionRef.current = null;
      libroInstanciaRef.current = null;

      if (contenedorVisorRef.current) {
        contenedorVisorRef.current.innerHTML = "";
      }

      try {
        if (!archivo) {
          throw new Error("No se recibió ningún archivo EPUB.");
        }

        let buffer;

        // El componente recibe el archivo ya descargado y autorizado.
        if (archivo instanceof Blob) {
          if (archivo.size === 0) {
            throw new Error("El archivo EPUB está vacío.");
          }

          buffer = await archivo.arrayBuffer();
        } else if (archivo instanceof ArrayBuffer) {
          buffer = archivo;
        } else if (ArrayBuffer.isView(archivo)) {
          buffer = archivo.buffer.slice(
            archivo.byteOffset,
            archivo.byteOffset + archivo.byteLength,
          );
        } else {
          throw new Error(
            "Formato de archivo no válido. Se esperaba un Blob o ArrayBuffer.",
          );
        }

        if (cancelado) return;

        if (!buffer || buffer.byteLength < 4) {
          throw new Error("El archivo EPUB está vacío o incompleto.");
        }

        // Un EPUB es un archivo ZIP.
        const firma = new Uint8Array(buffer, 0, 4);

        if (firma[0] !== 0x50 || firma[1] !== 0x4b) {
          throw new Error(
            "El archivo no parece ser un EPUB válido. Comprueba que se haya descargado correctamente.",
          );
        }

        // Crear el libro a partir de una copia del buffer.
        libro = ePub(buffer.slice(0));
        libroInstanciaRef.current = libro;

        await libro.ready;

        if (cancelado) {
          libro.destroy?.();
          return;
        }

        // Obtener el índice de capítulos.
        const navegacion = await libro.loaded.navigation;

        if (cancelado) {
          libro.destroy?.();
          return;
        }

        if (navegacion?.toc) {
          setCapitulos(navegacion.toc);
        }

        if (!contenedorVisorRef.current) {
          throw new Error("No se encontró el contenedor del lector.");
        }

        // Crear la vista.
        rendition = libro.renderTo(contenedorVisorRef.current, {
          width: "100%",
          height: "100%",
          flow: modoFlujo,
          manager: modoFlujo === "scrolled-doc" ? "continuous" : "default",
          spread: "none",
          allowScriptedContent: false,
        });

        renditionRef.current = rendition;

        // Las imágenes de los capítulos no deben quedarse en lazy loading.
        rendition.hooks.content.register((contenido) => {
          const documento = contenido?.document;

          if (!documento) return;

          documento.querySelectorAll("img").forEach((imagen) => {
            imagen.removeAttribute("loading");
            imagen.style.maxWidth = "100%";
            imagen.style.height = "auto";
          });
        });

        // Registrar el cambio de capítulo antes de mostrar la primera página.
        manejadorUbicacion = (ubicacion) => {
          if (cancelado) return;

          if (ubicacion?.start?.href) {
            setCapituloActual(ubicacion.start.href);
          }
        };

        rendition.on("relocated", manejadorUbicacion);

        aplicarEstilos(rendition, temaRef.current, tamanoFuenteRef.current);

        await rendition.display();

        if (cancelado) return;

        setCargando(false);
      } catch (e) {
        console.error("Error inicializando EPUB:", e);

        if (!cancelado) {
          setError(e?.message || "No se pudo abrir el libro EPUB.");
          setCargando(false);
        }
      }
    }

    inicializarLibro();

    return () => {
      cancelado = true;

      try {
        if (rendition && manejadorUbicacion) {
          rendition.off?.("relocated", manejadorUbicacion);
        }
      } catch {
        // La instancia puede haberse destruido previamente.
      }

      try {
        if (rendition) {
          rendition.destroy?.();
        }
      } catch {
        // Ignorar errores durante la limpieza.
      }

      try {
        if (libro) {
          libro.destroy?.();
        }
      } catch {
        // Ignorar errores durante la limpieza.
      }

      if (renditionRef.current === rendition) {
        renditionRef.current = null;
      }

      if (libroInstanciaRef.current === libro) {
        libroInstanciaRef.current = null;
      }

      if (contenedorVisorRef.current) {
        contenedorVisorRef.current.innerHTML = "";
      }
    };
  }, [archivo, modoFlujo, aplicarEstilos]);

  // Aplicar tema y tamaño de fuente sin reinicializar el libro.
  useEffect(() => {
    if (renditionRef.current) {
      aplicarEstilos(renditionRef.current, tema, tamanoFuente);
    }
  }, [tema, tamanoFuente, aplicarEstilos]);

  const irAnterior = useCallback(async () => {
    try {
      if (renditionRef.current) {
        await renditionRef.current.prev();
      }
    } catch (e) {
      console.warn("No se pudo ir a la página anterior:", e);
    }
  }, []);

  const irSiguiente = useCallback(async () => {
    try {
      if (renditionRef.current) {
        await renditionRef.current.next();
      }
    } catch (e) {
      console.warn("No se pudo ir a la página siguiente:", e);
    }
  }, []);

  const irACapitulo = useCallback(async (href) => {
    if (!href || !renditionRef.current) return;

    try {
      await renditionRef.current.display(href);
      setCapituloActual(href);
    } catch (e) {
      console.error("No se pudo abrir el capítulo:", e);
      setError("No se pudo abrir el capítulo seleccionado.");
    }
  }, []);

  // Navegación por teclado sin interferir con campos de formulario.
  useEffect(() => {
    function manejarTeclas(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
        return;
      }

      const elemento = e.target;

      if (
        elemento instanceof HTMLElement &&
        (elemento.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(elemento.tagName))
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        irAnterior();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        irSiguiente();
      }
    }

    window.addEventListener("keydown", manejarTeclas);

    return () => {
      window.removeEventListener("keydown", manejarTeclas);
    };
  }, [irAnterior, irSiguiente]);

  const coloresFondoVisor = {
    claro: "#ffffff",
    sepia: "#f4ecd8",
    oscuro: "#141e1b",
  };

  return (
    <section className="lector-epub">
      <header className="lector-epub-barra">
        <div className="lector-epub-informacion">
          <strong title={titulo}>{titulo}</strong>

          {capitulos.length > 0 && (
            <select
              className="lector-epub-select-capitulo"
              value={capituloActual}
              onChange={(e) => irACapitulo(e.target.value)}
              aria-label="Seleccionar capítulo"
              disabled={cargando || Boolean(error)}
            >
              <option value="">Ir al capítulo…</option>

              {capitulos.map((capitulo, indice) => (
                <option
                  key={`${capitulo.href}-${indice}`}
                  value={capitulo.href}
                >
                  {String(capitulo.label || `Capítulo ${indice + 1}`).trim()}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="lector-epub-controles">
          <div className="lector-epub-grupo-control">
            <button
              type="button"
              onClick={irAnterior}
              disabled={cargando || Boolean(error)}
            >
              ◀ Anterior
            </button>

            <button
              type="button"
              onClick={irSiguiente}
              disabled={cargando || Boolean(error)}
            >
              Siguiente ▶
            </button>
          </div>

          <div className="lector-epub-grupo-control">
            <button
              type="button"
              className={modoFlujo === "paginated" ? "activo" : ""}
              onClick={() => setModoFlujo("paginated")}
              disabled={cargando || modoFlujo === "paginated"}
            >
              Páginas
            </button>

            <button
              type="button"
              className={modoFlujo === "scrolled-doc" ? "activo" : ""}
              onClick={() => setModoFlujo("scrolled-doc")}
              disabled={cargando || modoFlujo === "scrolled-doc"}
            >
              Scroll
            </button>
          </div>

          <div className="lector-epub-grupo-control">
            <button
              type="button"
              onClick={() =>
                setTamanoFuente((fuente) => Math.max(80, fuente - 10))
              }
              disabled={tamanoFuente <= 80}
              aria-label="Reducir tamaño de letra"
            >
              A-
            </button>

            <span>{tamanoFuente}%</span>

            <button
              type="button"
              onClick={() =>
                setTamanoFuente((fuente) => Math.min(160, fuente + 10))
              }
              disabled={tamanoFuente >= 160}
              aria-label="Aumentar tamaño de letra"
            >
              A+
            </button>
          </div>

          <div className="lector-epub-grupo-control">
            <button
              type="button"
              className={tema === "claro" ? "activo" : ""}
              onClick={() => setTema("claro")}
              aria-pressed={tema === "claro"}
            >
              Claro
            </button>

            <button
              type="button"
              className={tema === "sepia" ? "activo" : ""}
              onClick={() => setTema("sepia")}
              aria-pressed={tema === "sepia"}
            >
              Sepia
            </button>

            <button
              type="button"
              className={tema === "oscuro" ? "activo" : ""}
              onClick={() => setTema("oscuro")}
              aria-pressed={tema === "oscuro"}
            >
              Noche
            </button>
          </div>
        </div>
      </header>

      <div
        className="lector-epub-visor"
        style={{ backgroundColor: coloresFondoVisor[tema] }}
      >
        {cargando && (
          <div className="lector-epub-overlay-carga">
            <div className="lector-epub-spinner" />
            <p>Abriendo libro EPUB…</p>
          </div>
        )}

        {error && (
          <div className="lector-epub-error" role="alert">
            <strong>No se pudo abrir el EPUB</strong>
            <p>{error}</p>
          </div>
        )}

        {!cargando && !error && modoFlujo === "paginated" && (
          <button
            type="button"
            className="lector-epub-flecha izquierda"
            onClick={irAnterior}
            aria-label="Página anterior"
          >
            ‹
          </button>
        )}

        <div ref={contenedorVisorRef} className="lector-epub-lienzo-nativo" />

        {!cargando && !error && modoFlujo === "paginated" && (
          <button
            type="button"
            className="lector-epub-flecha derecha"
            onClick={irSiguiente}
            aria-label="Página siguiente"
          >
            ›
          </button>
        )}
      </div>
    </section>
  );
}
