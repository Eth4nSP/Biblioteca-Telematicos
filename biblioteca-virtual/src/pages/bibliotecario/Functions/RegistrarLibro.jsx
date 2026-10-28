
import { useState } from 'react';
import ePub from 'epubjs';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '../../../lib/supabaseClient.js';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const FORMULARIO_INICIAL = {
  titulo: '',
  autor: '',
  descripcion: '',
  isbn: '',
  etiquetas: '',
  tipo_recurso: 'epub',
  portada_url: '',
};

export default function RegistrarLibro({ alRegistrar }) {
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [archivo, setArchivo] = useState(null);
  const [portadaBlob, setPortadaBlob] = useState(null);
  const [portadaPreview, setPortadaPreview] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  function cambiarCampo(e) {
    const { name, value } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value,
    }));
  }

  function limpiarHtml(html) {
    if (!html) return '';

    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  }

  async function manejarSeleccionArchivo(e) {
    const file = e.target.files?.[0] ?? null;

    setArchivo(file);
    setError('');
    setMensaje('');
    setPortadaBlob(null);
    setPortadaPreview('');

    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();

    if (!['epub', 'pdf'].includes(extension)) {
      setArchivo(null);
      setError('Solo se permiten archivos EPUB o PDF.');
      return;
    }

    setAnalizando(true);

    try {
      if (extension === 'epub') {
        await extraerMetadatosEpub(file);
      } else {
        await extraerMetadatosPdf(file);
      }
    } catch (err) {
      console.error('Error al leer metadatos:', err);

      setFormulario((actual) => ({
        ...actual,
        tipo_recurso: extension,
        titulo: actual.titulo || file.name.replace(/\.[^/.]+$/, ''),
      }));
    } finally {
      setAnalizando(false);
    }
  }

  async function extraerMetadatosEpub(file) {
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    const meta = await book.loaded.metadata;

    try {
      const coverUrl = await book.coverUrl();

      if (coverUrl) {
        setPortadaPreview(coverUrl);

        const response = await fetch(coverUrl);

        if (response.ok) {
          const blob = await response.blob();

          if (blob.size > 0) {
            setPortadaBlob(blob);
          }
        }
      }
    } catch (err) {
      console.warn('No se pudo extraer la portada del EPUB:', err);
    }

    const posibleIsbn = meta.identifier
      ? meta.identifier.replace(/^urn:isbn:/i, '').trim()
      : '';

    setFormulario((actual) => ({
      ...actual,
      tipo_recurso: 'epub',
      titulo: meta.title?.trim() || file.name.replace(/\.[^/.]+$/, ''),
      autor: meta.creator?.trim() || '',
      descripcion: limpiarHtml(meta.description).trim() || '',
      isbn: posibleIsbn || actual.isbn,
    }));
  }

  async function extraerMetadatosPdf(file) {
    const arrayBuffer = await file.arrayBuffer();

    const pdfDoc = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise;

    const metadata = await pdfDoc.getMetadata();
    const info = metadata?.info || {};

    try {
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo crear el contexto del canvas.');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setPortadaPreview(dataUrl);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.85);
      });

      if (blob) {
        setPortadaBlob(blob);
      }
    } catch (err) {
      console.warn('No se pudo generar la portada del PDF:', err);
    }

    const keywords = info.Keywords
      ? info.Keywords.replace(/;/g, ',').trim()
      : '';

    setFormulario((actual) => ({
      ...actual,
      tipo_recurso: 'pdf',
      titulo: info.Title?.trim() || file.name.replace(/\.[^/.]+$/, ''),
      autor: info.Author?.trim() || '',
      descripcion: info.Subject?.trim() || '',
      etiquetas: keywords || actual.etiquetas,
    }));
  }

  async function registrar(e) {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!archivo) {
      setError('Selecciona el archivo EPUB o PDF del libro.');
      return;
    }

    const extension = archivo.name.split('.').pop().toLowerCase();

    if (!['epub', 'pdf'].includes(extension)) {
      setError('Solo se permiten archivos EPUB o PDF.');
      return;
    }

    if (
      formulario.tipo_recurso !== extension ||
      !['epub', 'pdf'].includes(formulario.tipo_recurso)
    ) {
      setError(
        'El tipo de recurso seleccionado no coincide con la extensión del archivo.'
      );
      return;
    }

    if (!formulario.titulo.trim() || !formulario.autor.trim()) {
      setError('El título y el autor son obligatorios.');
      return;
    }

    setGuardando(true);

    const rutasSubidas = [];
    let registroCreado = false;

    try {
      const { data: usuarioData, error: usuarioError } =
        await supabase.auth.getUser();

      if (usuarioError) throw usuarioError;

      const usuario = usuarioData.user;

      if (!usuario) {
        throw new Error(
          'Tu sesión ha expirado. Inicia sesión nuevamente.'
        );
      }

      const nombreSeguro = archivo.name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

      const uuid = crypto.randomUUID();

      // El documento conserva su ruta actual para que
      // libros_select_autorizado pueda identificarlo.
      const rutaArchivo = `${usuario.id}/${uuid}-${nombreSeguro}`;

      const { error: subidaError } = await supabase.storage
        .from('libros')
        .upload(rutaArchivo, archivo, {
          upsert: false,
          contentType:
            extension === 'epub'
              ? 'application/epub+zip'
              : 'application/pdf',
        });

      if (subidaError) throw subidaError;

      rutasSubidas.push(rutaArchivo);

      // Se conserva el formato que espera la política
      // libros_select_autorizado. El bucket sigue siendo privado.
      const { data: urlArchivoData } = supabase.storage
        .from('libros')
        .getPublicUrl(rutaArchivo);

      const archivoUrl = urlArchivoData.publicUrl;

      // Prioridad: URL externa ingresada manualmente.
      // Si no existe, se sube la portada extraída del archivo.
      let portadaFinalUrl = formulario.portada_url.trim() || null;

      if (!portadaFinalUrl && portadaBlob) {
        const extPortada =
          portadaBlob.type === 'image/png' ? 'png' : 'jpg';

        // IMPORTANTE: la portada queda directamente en portadas/.
        const rutaPortada = `portadas/${uuid}-cover.${extPortada}`;

        const { error: errorPortada } = await supabase.storage
          .from('libros')
          .upload(rutaPortada, portadaBlob, {
            upsert: false,
            contentType: portadaBlob.type || 'image/jpeg',
          });

        if (errorPortada) throw errorPortada;

        rutasSubidas.push(rutaPortada);

        // Guardar la RUTA INTERNA, no una URL pública.
        // El catálogo generará una URL firmada para mostrarla.
        portadaFinalUrl = rutaPortada;
      }

      const etiquetas = formulario.etiquetas
        .split(',')
        .map((etiqueta) => etiqueta.trim())
        .filter(Boolean);

      const registro = {
        titulo: formulario.titulo.trim(),
        autor: formulario.autor.trim(),
        descripcion: formulario.descripcion.trim() || null,
        isbn: formulario.isbn.trim() || null,
        etiquetas,
        tipo_recurso: formulario.tipo_recurso.toLowerCase(),
        portada_url: portadaFinalUrl,
        archivo_url: archivoUrl,
        fecha_ingreso: new Date().toISOString(),
      };

      const { data, error: registroError } = await supabase
        .from('recursos_bibliograficos')
        .insert(registro)
        .select()
        .single();

      if (registroError) throw registroError;

      registroCreado = true;

      setFormulario({ ...FORMULARIO_INICIAL });
      setArchivo(null);
      setPortadaBlob(null);
      setPortadaPreview('');

      if (e.target instanceof HTMLFormElement) {
        e.target.reset();
      }

      setMensaje(
        `El recurso "${data.titulo}" se registró correctamente.`
      );

      if (alRegistrar) {
        try {
          alRegistrar(data);
        } catch (callbackError) {
          console.error(
            'El recurso se guardó, pero falló la actualización de la interfaz:',
            callbackError
          );
        }
      }
    } catch (err) {
      console.error('Error al registrar el libro:', err);

      // Si falla el registro, retirar los archivos recién subidos.
      if (rutasSubidas.length > 0 && !registroCreado) {
        const { error: limpiezaError } = await supabase.storage
          .from('libros')
          .remove(rutasSubidas);

        if (limpiezaError) {
          console.error(
            'No se pudieron eliminar los archivos subidos:',
            limpiezaError
          );
        }
      }

      setError(
        err?.message ||
          'No se pudo registrar el recurso. Revisa los permisos de Supabase.'
      );
    } finally {
      setGuardando(false);
    }
  }

  const portadaParaVistaPrevia =
    formulario.portada_url.trim() || portadaPreview;

  return (
    <section>
      <h2>Registrar libro o recurso digital</h2>

      <p>
        Selecciona el archivo para autocompletar los metadatos disponibles
        y edita o completa manualmente los campos que falten.
      </p>

      {mensaje && (
        <p role="status" style={{ color: 'green' }}>
          {mensaje}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      <form onSubmit={registrar}>
        <div>
          <label htmlFor="archivo">
            Archivo del recurso (EPUB o PDF) *
          </label>

          <input
            id="archivo"
            type="file"
            accept=".epub,.pdf,application/pdf,application/epub+zip"
            onChange={manejarSeleccionArchivo}
            required
          />

          {analizando && (
            <p>Extrayendo metadatos y portada del archivo...</p>
          )}

          {archivo && !analizando && (
            <p>Archivo seleccionado: {archivo.name}</p>
          )}
        </div>

        {portadaParaVistaPrevia && (
          <div style={{ margin: '12px 0' }}>
            <p style={{ marginBottom: '6px' }}>
              Vista previa de portada:
            </p>

            <img
              src={portadaParaVistaPrevia}
              alt="Vista previa de portada"
              style={{
                width: '120px',
                height: 'auto',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
            />
          </div>
        )}

        <div>
          <label htmlFor="titulo">Título *</label>
          <input
            id="titulo"
            name="titulo"
            value={formulario.titulo}
            onChange={cambiarCampo}
            placeholder="Introduce el título si no se detectó"
            required
            maxLength={300}
          />
        </div>

        <div>
          <label htmlFor="autor">Autor *</label>
          <input
            id="autor"
            name="autor"
            value={formulario.autor}
            onChange={cambiarCampo}
            placeholder="Introduce el autor manualmente si no se detectó"
            required
            maxLength={300}
          />
        </div>

        <div>
          <label htmlFor="isbn">ISBN</label>
          <input
            id="isbn"
            name="isbn"
            value={formulario.isbn}
            onChange={cambiarCampo}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formulario.descripcion}
            onChange={cambiarCampo}
            rows={4}
            placeholder="Sinopsis o resumen del recurso"
          />
        </div>

        <div>
          <label htmlFor="etiquetas">
            Etiquetas (separadas por comas)
          </label>
          <input
            id="etiquetas"
            name="etiquetas"
            value={formulario.etiquetas}
            onChange={cambiarCampo}
            placeholder="Fantasía, Novela, Literatura"
          />
        </div>

        <div>
          <label htmlFor="tipo_recurso">Tipo de recurso *</label>
          <select
            id="tipo_recurso"
            name="tipo_recurso"
            value={formulario.tipo_recurso}
            onChange={cambiarCampo}
            required
          >
            <option value="epub">EPUB</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div>
          <label htmlFor="portada_url">
            URL de portada externa (opcional, reemplaza la detectada)
          </label>

          <input
            id="portada_url"
            name="portada_url"
            type="url"
            value={formulario.portada_url}
            onChange={cambiarCampo}
            placeholder="https://..."
          />
        </div>

        <button type="submit" disabled={guardando || analizando}>
          {guardando
            ? 'Registrando...'
            : analizando
              ? 'Analizando archivo...'
              : 'Registrar recurso'}
        </button>
      </form>
    </section>
  );
}
