import { useState } from 'react';
import { supabase } from '../supabaseClient';

function AgregarLibro({ onLibroAgregado }) {

  const [titulo, setTitulo] = useState('');
  const [autor, setAutor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [isbn, setIsbn] = useState('');
  const [tipoRecurso, setTipoRecurso] = useState('libro digital');

  const [archivo, setArchivo] = useState(null);
  const [portada, setPortada] = useState(null);

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  async function guardarLibro(e) {

    e.preventDefault();

    setCargando(true);
    setMensaje('');
    setError('');

    try {

      // ==========================================
      // VALIDACIONES
      // ==========================================

      if (!archivo) {
        throw new Error('Debes seleccionar un archivo EPUB o PDF.');
      }

      const nombreArchivo = archivo.name.toLowerCase();

      const esEPUB = nombreArchivo.endsWith('.epub');
      const esPDF = nombreArchivo.endsWith('.pdf');

      if (!esEPUB && !esPDF) {
        throw new Error(
          'El archivo debe ser EPUB o PDF.'
        );
      }


      // ==========================================
      // NOMBRE ÚNICO
      // ==========================================

      const nombreUnico =
        `${crypto.randomUUID()}-${archivo.name}`;


      const rutaArchivo =
        `libros/${nombreUnico}`;


      // ==========================================
      // SUBIR ARCHIVO
      // ==========================================

      const {
        error: errorArchivo
      } = await supabase.storage
        .from('libros')
        .upload(
          rutaArchivo,
          archivo,
          {
            cacheControl: '3600',
            upsert: false
          }
        );


      if (errorArchivo) {
        throw errorArchivo;
      }


      // ==========================================
      // PORTADA
      // ==========================================

      let portadaUrl = null;

      if (portada) {

        const nombrePortada =
          `${crypto.randomUUID()}-${portada.name}`;

        const rutaPortada =
          `portadas/${nombrePortada}`;


        const {
          error: errorPortada
        } = await supabase.storage
          .from('libros')
          .upload(
            rutaPortada,
            portada,
            {
              cacheControl: '3600',
              upsert: false
            }
          );


        if (errorPortada) {
          throw errorPortada;
        }


        const {
          data: portadaPublica
        } = supabase.storage
          .from('libros')
          .getPublicUrl(rutaPortada);


        portadaUrl =
          portadaPublica.publicUrl;
      }


      // ==========================================
      // GUARDAR EN BASE DE DATOS
      // ==========================================

      const {
        error: errorBD
      } = await supabase
        .from('recursos_bibliograficos')
        .insert({

          titulo: titulo,

          autor: autor,

          descripcion:
            descripcion || null,

          isbn:
            isbn || null,

          tipo_recurso:
            tipoRecurso,

          portada_url:
            portadaUrl,

          archivo_url:
            rutaArchivo

        });


      if (errorBD) {

        // Si la BD falla, intentamos
        // eliminar el archivo que acabamos de subir.

        await supabase.storage
          .from('libros')
          .remove([
            rutaArchivo
          ]);

        throw errorBD;
      }


      // ==========================================
      // ÉXITO
      // ==========================================

      setMensaje(
        'Libro agregado correctamente.'
      );

      setTitulo('');
      setAutor('');
      setDescripcion('');
      setIsbn('');
      setTipoRecurso('libro digital');

      setArchivo(null);
      setPortada(null);


      if (onLibroAgregado) {
        onLibroAgregado();
      }

    } catch (error) {

      console.error(
        'Error agregando libro:',
        error
      );

      setError(
        error.message ||
        'No se pudo agregar el libro.'
      );

    } finally {

      setCargando(false);

    }
  }


  return (

    <div className="agregar-libro">

      <h2>
        📚 Agregar recurso bibliográfico
      </h2>


      <form onSubmit={guardarLibro}>

        <div className="form-group">

          <label>
            Título
          </label>

          <input
            type="text"
            value={titulo}
            onChange={(e) =>
              setTitulo(e.target.value)
            }
            required
          />

        </div>


        <div className="form-group">

          <label>
            Autor
          </label>

          <input
            type="text"
            value={autor}
            onChange={(e) =>
              setAutor(e.target.value)
            }
            required
          />

        </div>


        <div className="form-group">

          <label>
            Descripción
          </label>

          <textarea
            value={descripcion}
            onChange={(e) =>
              setDescripcion(e.target.value)
            }
          />

        </div>


        <div className="form-group">

          <label>
            ISBN
          </label>

          <input
            type="text"
            value={isbn}
            onChange={(e) =>
              setIsbn(e.target.value)
            }
          />

        </div>


        <div className="form-group">

          <label>
            Tipo de recurso
          </label>

          <select
            value={tipoRecurso}
            onChange={(e) =>
              setTipoRecurso(e.target.value)
            }
          >

            <option value="libro digital">
              Libro digital
            </option>

            <option value="tesis">
              Tesis
            </option>

            <option value="artículo científico">
              Artículo científico
            </option>

          </select>

        </div>


        <div className="form-group">

          <label>
            Archivo EPUB o PDF
          </label>

          <input
            type="file"
            accept=".epub,.pdf"
            onChange={(e) =>
              setArchivo(
                e.target.files[0]
              )
            }
            required
          />

        </div>


        <div className="form-group">

          <label>
            Portada
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setPortada(
                e.target.files[0]
              )
            }
          />

        </div>


        {error && (

          <div className="login-error">
            {error}
          </div>

        )}


        {mensaje && (

          <div className="login-success">
            {mensaje}
          </div>

        )}


        <button
          type="submit"
          className="login-button"
          disabled={cargando}
        >

          {cargando
            ? 'Guardando libro...'
            : 'Guardar libro'}

        </button>

      </form>

    </div>

  );
}

export default AgregarLibro;