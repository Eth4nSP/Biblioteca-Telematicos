
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import LectorEpub from "./LectorEpub.jsx";
import "../styles/Estudiante/LectorEpub.css";

const INTERVALO_LATIDO = 30_000;

function obtenerRutaStorage(archivoUrl) {
  const valor = archivoUrl?.trim();

  if (!valor) {
    throw new Error("Este libro no tiene un archivo_url configurado.");
  }

  // Acepta URL antiguas de Storage, aunque incluyan /public/ en la ruta.
  if (/^https?:\/\//i.test(valor)) {
    let url;

    try {
      url = new URL(valor);
    } catch {
      throw new Error("La URL del archivo no es válida.");
    }

    const coincidencia = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/,
    );

    if (!coincidencia) {
      throw new Error(
        "La URL no corresponde a un archivo reconocido de Supabase Storage.",
      );
    }

    return {
      bucket: decodeURIComponent(coincidencia[1]),
      ruta: coincidencia[2]
        .split("/")
        .map((parte) => decodeURIComponent(parte))
        .join("/"),
    };
  }

  // También permite rutas relativas: bucket/ruta/archivo.pdf.
  const rutaLimpia = valor.replace(/^\/+/, "");
  const separador = rutaLimpia.indexOf("/");

  if (separador < 1) {
    throw new Error(
      "La ruta debe incluir el bucket y el nombre del archivo.",
    );
  }

  return {
    bucket: rutaLimpia.slice(0, separador),
    ruta: rutaLimpia.slice(separador + 1),
  };
}

async function descargarArchivoPrivado(archivoUrl) {
  const { bucket, ruta } = obtenerRutaStorage(archivoUrl);

  // El acceso real queda protegido por la política RLS de Storage.
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(ruta);

  if (error || !data) {
    console.error("[ARCHIVO] Error de descarga:", error);

    throw new Error(
      error?.message ||
        "No se pudo descargar el archivo. Verifica los permisos de lectura.",
    );
  }

  return data;
}

async function cerrarSesionLectura(idSesion) {
  if (!idSesion) return;

  const { data, error } = await supabase.rpc("cerrar_sesion_lectura", {
    p_sesion_id: idSesion,
  });

  if (error) throw error;

  if (data !== true) {
    console.warn(
      "[LECTURA] La sesión ya estaba cerrada o no se pudo cerrar:",
      idSesion,
    );
  } else {
    console.log("[LECTURA] Sesión cerrada:", idSesion);
  }
}

export default function VisorDocumento({ libro, onCerrar }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [bufferEpub, setBufferEpub] = useState(null);
  const [urlPdf, setUrlPdf] = useState("");
  const [cerrando, setCerrando] = useState(false);

  const sesionRef = useRef(null);
  const visorCerradoRef = useRef(false);
  const cierreEnCursoRef = useRef(false);
  const cerrarPendienteRef = useRef(false);

  const recursoId = libro?.id ?? libro?.recurso_id;
  const formato = (libro?.tipo_recurso || "").toLowerCase();
  const esEpub = formato === "epub";

  // Autorizar, crear la sesión y descargar el archivo privado.
  useEffect(() => {
    let cancelado = false;
    let intervaloLatido = null;
    let urlObjeto = null;
    let idSesionLocal = null;

    visorCerradoRef.current = false;
    cierreEnCursoRef.current = false;
    cerrarPendienteRef.current = false;

    setCargando(true);
    setError("");
    setBufferEpub(null);
    setUrlPdf("");

    function detenerLatido() {
      if (intervaloLatido !== null) {
        window.clearInterval(intervaloLatido);
        intervaloLatido = null;
      }
    }

    async function cerrarSesionSilenciosamente(id) {
      if (!id) return;

      try {
        await cerrarSesionLectura(id);
      } catch (err) {
        console.error(
          "[LECTURA] No se pudo cerrar una sesión pendiente:",
          err,
        );
      }
    }

    async function actualizarLatido() {
      if (
        cancelado ||
        visorCerradoRef.current ||
        !idSesionLocal
      ) {
        return;
      }

      try {
        const { data, error: errorLatido } = await supabase.rpc(
          "latido_sesion",
          {
            p_sesion_id: idSesionLocal,
          },
        );

        if (errorLatido) {
          console.error(
            "[LECTURA] Error en el latido:",
            errorLatido.message,
          );
          return;
        }

        if (data !== true) {
          detenerLatido();

          if (!cancelado && !visorCerradoRef.current) {
            setBufferEpub(null);
            setUrlPdf("");
            setError(
              "Tu permiso de lectura ya no está vigente o la sesión se cerró. " +
                "Vuelve al catálogo para continuar.",
            );
            setCargando(false);
          }
        }
      } catch (err) {
        console.error("[LECTURA] Falló el latido:", err);
      }
    }

    async function cargarDocumento() {
      try {
        if (!recursoId) {
          throw new Error("No se ha identificado el libro.");
        }

        if (formato !== "pdf" && formato !== "epub") {
          throw new Error(
            `El formato "${libro?.tipo_recurso}" no es compatible.`,
          );
        }

        // 1. Comprobar la identidad del usuario.
        const {
          data: { user },
          error: errorAuth,
        } = await supabase.auth.getUser();

        if (errorAuth) throw errorAuth;

        if (!user) {
          throw new Error("Debes iniciar sesión para leer este libro.");
        }

        if (cancelado || visorCerradoRef.current) return;

        // 2. Verificar el permiso antes de crear la sesión o descargar.
        const { data: autorizado, error: errorPermiso } =
          await supabase.rpc("puede_leer_recurso", {
            p_recurso_id: recursoId,
          });

        if (errorPermiso) throw errorPermiso;

        if (autorizado !== true) {
          throw new Error(
            "No tienes permiso para leer este libro o tu autorización ha vencido.",
          );
        }

        if (cancelado || visorCerradoRef.current) return;

        // 3. Crear una sesión propia para este visor.
        const { data: nuevaSesion, error: errorCreacion } = await supabase
          .from("sesiones_lectura")
          .insert({
            recurso_id: recursoId,
            usuario_id: user.id,
          })
          .select("id")
          .single();

        if (errorCreacion) throw errorCreacion;

        idSesionLocal = nuevaSesion.id;
        sesionRef.current = idSesionLocal;

        // Si se cerró el visor mientras se creaba la sesión, cerrarla.
        if (
          cancelado ||
          visorCerradoRef.current ||
          cerrarPendienteRef.current
        ) {
          await cerrarSesionSilenciosamente(idSesionLocal);
          return;
        }

        console.log("[LECTURA] Sesión iniciada:", idSesionLocal);

        // 4. Descargar el archivo privado. Storage vuelve a comprobar RLS.
        const blobDescargado = await descargarArchivoPrivado(
          libro?.archivo_url,
        );

        if (cancelado || visorCerradoRef.current) return;

        const buffer = await blobDescargado.arrayBuffer();

        if (cancelado || visorCerradoRef.current) return;

        if (buffer.byteLength === 0) {
          throw new Error("El archivo descargado está vacío.");
        }

        // 5. Validar el formato antes de mostrarlo.
        if (formato === "pdf") {
          const firma = new Uint8Array(buffer.slice(0, 4));
          const esPdf =
            firma[0] === 0x25 &&
            firma[1] === 0x50 &&
            firma[2] === 0x44 &&
            firma[3] === 0x46;

          if (!esPdf) {
            throw new Error(
              "El archivo descargado no tiene un formato PDF válido.",
            );
          }

          const pdfBlob = new Blob([buffer], {
            type: "application/pdf",
          });

          urlObjeto = URL.createObjectURL(pdfBlob);
          setUrlPdf(`${urlObjeto}#toolbar=0&navpanes=0`);
        } else {
          const firma = new Uint8Array(buffer.slice(0, 2));

          if (firma[0] !== 0x50 || firma[1] !== 0x4b) {
            throw new Error(
              "El archivo descargado no parece ser un EPUB válido.",
            );
          }

          setBufferEpub(buffer);
        }

        if (cancelado || visorCerradoRef.current) return;

        // 6. Mantener viva la sesión usando la función segura del servidor.
        intervaloLatido = window.setInterval(() => {
          void actualizarLatido();
        }, INTERVALO_LATIDO);

        setCargando(false);
        console.log("[ARCHIVO] Documento validado.");
      } catch (err) {
        console.error("[ARCHIVO] No se pudo abrir:", err);

        if (!cancelado) {
          setError(err?.message || "Error al abrir el documento.");
          setCargando(false);
        }

        // No dejar sesiones activas si la descarga o validación falla.
        if (idSesionLocal) {
          await cerrarSesionSilenciosamente(idSesionLocal);
          idSesionLocal = null;
          sesionRef.current = null;
        }
      }
    }

    void cargarDocumento();

    return () => {
      cancelado = true;
      detenerLatido();

      if (urlObjeto) {
        URL.revokeObjectURL(urlObjeto);
      }

      // Cerrar la sesión de este visor al desmontarlo o cambiar de libro.
      if (idSesionLocal) {
        if (sesionRef.current === idSesionLocal) {
          sesionRef.current = null;
        }

        void cerrarSesionSilenciosamente(idSesionLocal);
      }
    };
  }, [libro, recursoId, formato]);

  const manejarCierre = useCallback(async () => {
    if (cierreEnCursoRef.current) return;

    cierreEnCursoRef.current = true;
    cerrarPendienteRef.current = true;
    visorCerradoRef.current = true;
    setCerrando(true);

    try {
      const idSesion = sesionRef.current;

      if (idSesion) {
        await cerrarSesionLectura(idSesion);
        sesionRef.current = null;
      }
    } catch (err) {
      console.error("[LECTURA] Error al cerrar:", err);

      window.alert(
        "No se pudo confirmar el cierre de la sesión en el servidor. " +
          "La sesión podría seguir contando temporalmente como activa.",
      );
    } finally {
      setCerrando(false);
      onCerrar?.();
    }
  }, [onCerrar]);

  return (
    <div
      className="visor-modal-overlay"
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="visor-modal-cabecera">
        <div className="visor-modal-titulo">
          <span className="visor-modal-formato">
            {libro?.tipo_recurso?.toUpperCase()}
          </span>

          <div>
            <h2>{libro?.titulo}</h2>
            <p>{libro?.autor}</p>
          </div>
        </div>

        <button
          type="button"
          className="visor-btn-cerrar"
          onClick={manejarCierre}
          disabled={cerrando}
        >
          {cerrando ? "Cerrando…" : "✕ Cerrar lector"}
        </button>
      </header>

      <div className="visor-modal-cuerpo">
        {cargando && (
          <div className="lector-epub-estado">
            <div className="lector-epub-spinner" />
            <p>Verificando permisos y cargando documento…</p>
          </div>
        )}

        {!cargando && error && (
          <div className="lector-epub-error" role="alert">
            <strong>No se pudo abrir el documento</strong>
            <p>{error}</p>

            <button
              type="button"
              className="visor-btn-reintentar"
              onClick={manejarCierre}
              disabled={cerrando}
            >
              Volver al catálogo
            </button>
          </div>
        )}

        {!cargando && !error && !esEpub && urlPdf && (
          <iframe
            src={urlPdf}
            title={`Lector PDF - ${libro?.titulo}`}
            className="visor-pdf-iframe"
          />
        )}

        {!cargando && !error && esEpub && bufferEpub && (
          <LectorEpub
            archivo={bufferEpub}
            titulo={libro?.titulo}
          />
        )}
      </div>
    </div>
  );
}
