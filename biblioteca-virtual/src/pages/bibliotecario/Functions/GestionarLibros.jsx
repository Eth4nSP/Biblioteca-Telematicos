
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient.js';
import '../../../styles/Bibliotecario/GestionarLibros.css';

const CAMPOS = `
  id,
  titulo,
  autor,
  descripcion,
  isbn,
  etiquetas,
  tipo_recurso,
  portada_url,
  archivo_url,
  fecha_ingreso,
  total_existencias
`;

const FORMULARIO_VACIO = {
  titulo: '',
  autor: '',
  descripcion: '',
  isbn: '',
  etiquetas: '',
  tipo_recurso: '',
  portada_url: '',
  archivo_url: '',
  total_existencias: '5',
};


const CACHE_PORTADAS = new Map();
const DURACION_CACHE_PORTADAS = 55 * 60 * 1000;

const resolverPortada = async (valor) => {
  if (!valor?.trim()) return null;

  const original = valor.trim();

  // Si no es una URL, se interpreta como ruta interna del bucket.
  let ruta = original;

  try {
    const url = new URL(original);

    const marcadorPublico = '/storage/v1/object/public/libros/';
    const marcadorPrivado = '/storage/v1/object/sign/libros/';

    let posicion = url.pathname.indexOf(marcadorPublico);

    if (posicion !== -1) {
      ruta = url.pathname.slice(posicion + marcadorPublico.length);
    } else {
      posicion = url.pathname.indexOf(marcadorPrivado);

      if (posicion !== -1) {
        ruta = url.pathname.slice(posicion + marcadorPrivado.length);
      } else {
        // URL externa: no necesita una URL firmada de Supabase.
        return original;
      }
    }

    ruta = decodeURIComponent(ruta);
  } catch {
    // Es una ruta relativa almacenada en Supabase.
  }

  ruta = ruta.replace(/^\/+/, '');

  // Evitar incluir accidentalmente el nombre del bucket en la ruta.
  if (ruta.startsWith('libros/')) {
    ruta = ruta.slice('libros/'.length);
  }

  if (!ruta) return null;

  const ahora = Date.now();
  const entradaCache = CACHE_PORTADAS.get(ruta);

  if (entradaCache && entradaCache.expira > ahora) {
    return entradaCache.url;
  }

  const { data, error } = await supabase.storage
    .from('libros')
    .createSignedUrl(ruta, 3600);

  if (error) {
    console.error('Error al generar URL de portada:', ruta, error.message);
    return null;
  }

  const urlFirmada = data?.signedUrl || null;

  if (urlFirmada) {
    CACHE_PORTADAS.set(ruta, {
      url: urlFirmada,
      expira: ahora + DURACION_CACHE_PORTADAS,
    });
  }

  return urlFirmada;
};


const fechaLegible = (valor) => {
  if (!valor) return 'No disponible';

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? 'No disponible'
    : fecha.toLocaleString('es-BO');
};

const prepararFormulario = (libro) => ({
  titulo: libro.titulo || '',
  autor: libro.autor || '',
  descripcion: libro.descripcion || '',
  isbn: libro.isbn || '',
  etiquetas: Array.isArray(libro.etiquetas)
    ? libro.etiquetas.join(', ')
    : '',
  tipo_recurso: libro.tipo_recurso || '',
  portada_url: libro.portada_url || '',
  archivo_url: libro.archivo_url || '',
  total_existencias: String(libro.total_existencias ?? 0),
});

const obtenerMensajeError = (error) => {
  if (error?.code === '42501') {
    return 'No tienes permisos para modificar libros. Revisa las políticas RLS.';
  }

  if (error?.code === '23505') {
    return 'Ya existe un registro que entra en conflicto con estos datos.';
  }

  if (error?.code === '23503') {
    return 'No se puede guardar el cambio porque existen referencias relacionadas.';
  }

  return error?.message || 'Ocurrió un error inesperado.';
};

export default function GestionarLibros() {
  const [libros, setLibros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [libroSeleccionado, setLibroSeleccionado] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargarLibros = useCallback(async () => {
    setCargando(true);
    setError('');
    setMensaje('');

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData?.user) {
        throw new Error('Debes iniciar sesión para gestionar los libros.');
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', authData.user.id)
        .single();

      if (perfilError) throw perfilError;

      if (
        String(perfil?.rol || '').trim().toLowerCase() !== 'bibliotecario'
      ) {
        throw new Error(
          'Solo el bibliotecario puede acceder a esta sección.'
        );
      }

      const { data, error: consultaError } = await supabase
        .from('recursos_bibliograficos')
        .select(CAMPOS)
        .order('titulo', { ascending: true })
        .limit(500);

      if (consultaError) throw consultaError;

      const librosConPortadas = await Promise.all(
  (data || []).map(async (libro) => ({
    ...libro,
    portada_resuelta: await resolverPortada(libro.portada_url),
  }))
);

setLibros(librosConPortadas);
    } catch (err) {
      console.error('Error al cargar libros:', err);
      setError(obtenerMensajeError(err));
      setLibros([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarLibros();
  }, [cargarLibros]);

  const librosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) return libros;

    return libros.filter((libro) => {
      const texto = [
        libro.titulo,
        libro.autor,
        libro.isbn,
        libro.tipo_recurso,
        ...(Array.isArray(libro.etiquetas) ? libro.etiquetas : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return texto.includes(termino);
    });
  }, [libros, busqueda]);

  const cambiarCampo = (campo, valor) => {
    setFormulario((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  };

  const abrirEdicion = (libro) => {
    setLibroSeleccionado(libro);
    setFormulario(prepararFormulario(libro));
    setError('');
    setMensaje('');
  };

  const cancelarEdicion = () => {
    if (guardando) return;

    setLibroSeleccionado(null);
    setFormulario(FORMULARIO_VACIO);
    setError('');
  };

  const guardarCambios = async (e) => {
    e.preventDefault();

    if (!libroSeleccionado?.id) {
      setError('Selecciona un libro para editar.');
      return;
    }

    const titulo = formulario.titulo.trim();
    const autor = formulario.autor.trim();
    const archivoUrl = formulario.archivo_url.trim();
    const existencias = Number(formulario.total_existencias);

    if (!titulo || !autor) {
      setError('El título y el autor son obligatorios.');
      return;
    }

    if (!archivoUrl) {
      setError('La URL del archivo es obligatoria.');
      return;
    }

    if (
      formulario.total_existencias.trim() === '' ||
      !Number.isSafeInteger(existencias) ||
      existencias < 0
    ) {
      setError('Las existencias deben ser un número entero igual o mayor que cero.');
      return;
    }

    const etiquetas = [
      ...new Set(
        formulario.etiquetas
          .split(',')
          .map((etiqueta) => etiqueta.trim())
          .filter(Boolean)
      ),
    ];

    const cambios = {
      titulo,
      autor,
      descripcion: formulario.descripcion.trim() || null,
      isbn: formulario.isbn.trim() || null,
      etiquetas,
      tipo_recurso: formulario.tipo_recurso.trim() || null,
      portada_url: formulario.portada_url.trim() || null,
      archivo_url: archivoUrl,
      total_existencias: existencias,
    };

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const { data, error: actualizacionError } = await supabase
        .from('recursos_bibliograficos')
        .update(cambios)
        .eq('id', libroSeleccionado.id)
        .select(CAMPOS)
        .single();

      if (actualizacionError) throw actualizacionError;

const libroActualizado = {
  ...data,
  portada_resuelta: await resolverPortada(data.portada_url),
};

setLibros((actuales) =>
  actuales.map((libro) =>
    libro.id === libroActualizado.id ? libroActualizado : libro
  )
);

      setLibroSeleccionado(null);
      setFormulario(FORMULARIO_VACIO);
      setMensaje(`Se actualizaron los datos de "${data.titulo}".`);
    } catch (err) {
      console.error('Error al actualizar libro:', err);
      setError(obtenerMensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="gl-contenedor">
      <header className="gl-encabezado">
        <div>
          <h1>Gestionar libros</h1>
          <p>
            Consulta y modifica los datos de los recursos bibliográficos
            registrados en la biblioteca.
          </p>
        </div>

        <button
          type="button"
          className="gl-btn gl-btn-secundario"
          onClick={cargarLibros}
          disabled={cargando || guardando}
        >
          Actualizar lista
        </button>
      </header>

      {mensaje && (
        <div className="gl-alerta gl-alerta-exito" role="status">
          {mensaje}
        </div>
      )}

      {error && (
        <div className="gl-alerta gl-alerta-error" role="alert">
          {error}
        </div>
      )}

      <section className="gl-herramientas">
        <label className="gl-busqueda">
          <span>Buscar libro</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Título, autor, ISBN o etiqueta..."
          />
        </label>

        <div className="gl-total">
          <strong>{librosFiltrados.length}</strong>
          <span>
            {librosFiltrados.length === 1 ? 'libro encontrado' : 'libros encontrados'}
          </span>
        </div>
      </section>

      {cargando ? (
        <div className="gl-vacio">Cargando catálogo...</div>
      ) : librosFiltrados.length === 0 ? (
        <div className="gl-vacio">
          <h2>No se encontraron libros</h2>
          <p>Prueba con otro título, autor, ISBN o etiqueta.</p>
        </div>
      ) : (
        <div className="gl-tabla-contenedor">
          <table className="gl-tabla">
            <thead>
              <tr>
                <th>Libro</th>
                <th>Autor</th>
                <th>ISBN</th>
                <th>Tipo</th>
                <th>Existencias</th>
                <th>Fecha de ingreso</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {librosFiltrados.map((libro) => (
                <tr key={libro.id}>
                  <td>
                    <div className="gl-libro">
                      {libro.portada_resuelta ? (
  <img
    src={libro.portada_resuelta}
    alt={`Portada de ${libro.titulo}`}
    loading="lazy"
    onError={(e) => {
      console.error(
        'No se pudo cargar la portada:',
        libro.titulo,
        libro.portada_url
      );
      e.currentTarget.style.display = 'none';
    }}
  />
) : (
  <div className="gl-portada-vacia">Sin portada</div>
)}

                      <div>
                        <strong>{libro.titulo}</strong>
                        <small>
                          {libro.descripcion || 'Sin descripción'}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>{libro.autor}</td>
                  <td>{libro.isbn || '—'}</td>
                  <td>{libro.tipo_recurso || '—'}</td>
                  <td>{libro.total_existencias ?? 0}</td>
                  <td>{fechaLegible(libro.fecha_ingreso)}</td>

                  <td>
                    <button
                      type="button"
                      className="gl-btn gl-btn-editar"
                      onClick={() => abrirEdicion(libro)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {libroSeleccionado && (
        <div
          className="gl-modal-fondo"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelarEdicion();
          }}
        >
          <section
            className="gl-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gl-titulo-modal"
          >
            <header className="gl-modal-encabezado">
              <div>
                <h2 id="gl-titulo-modal">Editar libro</h2>
                <p>Modifica los datos del recurso seleccionado.</p>
              </div>

              <button
                type="button"
                className="gl-cerrar"
                onClick={cancelarEdicion}
                disabled={guardando}
                aria-label="Cerrar"
              >
                ×
              </button>
            </header>

            <form onSubmit={guardarCambios}>
              <div className="gl-formulario">
                <label className="gl-campo gl-campo-completo">
                  <span>Título *</span>
                  <input
                    type="text"
                    value={formulario.titulo}
                    onChange={(e) => cambiarCampo('titulo', e.target.value)}
                    maxLength={500}
                    required
                  />
                </label>

                <label className="gl-campo">
                  <span>Autor *</span>
                  <input
                    type="text"
                    value={formulario.autor}
                    onChange={(e) => cambiarCampo('autor', e.target.value)}
                    maxLength={300}
                    required
                  />
                </label>

                <label className="gl-campo">
                  <span>ISBN</span>
                  <input
                    type="text"
                    value={formulario.isbn}
                    onChange={(e) => cambiarCampo('isbn', e.target.value)}
                    maxLength={50}
                  />
                </label>

                <label className="gl-campo">
                  <span>Tipo de recurso</span>
                  <input
                    type="text"
                    value={formulario.tipo_recurso}
                    onChange={(e) => cambiarCampo('tipo_recurso', e.target.value)}
                    placeholder="Ej. libro, revista, tesis..."
                    maxLength={100}
                  />
                </label>

                <label className="gl-campo">
                  <span>Existencias</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formulario.total_existencias}
                    onChange={(e) =>
                      cambiarCampo('total_existencias', e.target.value)
                    }
                    required
                  />
                </label>

                <label className="gl-campo gl-campo-completo">
                  <span>Descripción</span>
                  <textarea
                    rows={4}
                    value={formulario.descripcion}
                    onChange={(e) =>
                      cambiarCampo('descripcion', e.target.value)
                    }
                    maxLength={10000}
                  />
                </label>

                <label className="gl-campo gl-campo-completo">
                  <span>Etiquetas</span>
                  <input
                    type="text"
                    value={formulario.etiquetas}
                    onChange={(e) =>
                      cambiarCampo('etiquetas', e.target.value)
                    }
                    placeholder="historia, programación, matemática"
                  />
                  <small>Separa las etiquetas con comas.</small>
                </label>

                <label className="gl-campo gl-campo-completo">
                  <span>URL de portada</span>
                  <input
                    type="url"
                    value={formulario.portada_url}
                    onChange={(e) =>
                      cambiarCampo('portada_url', e.target.value)
                    }
                    placeholder="https://..."
                  />
                </label>

                <label className="gl-campo gl-campo-completo">
                  <span>URL del archivo *</span>
                  <input
                    type="text"
                    value={formulario.archivo_url}
                    onChange={(e) =>
                      cambiarCampo('archivo_url', e.target.value)
                    }
                    required
                  />
                  <small>
                    Conserva la ruta correcta si el archivo está alojado en
                    Supabase Storage.
                  </small>
                </label>

                <div className="gl-campo gl-campo-completo gl-fecha-ingreso">
                  <span>Fecha de ingreso</span>
                  <p>{fechaLegible(libroSeleccionado.fecha_ingreso)}</p>
                  <small>
                    La fecha original se conserva y no se modifica al editar.
                  </small>
                </div>
              </div>

              <footer className="gl-modal-acciones">
                <button
                  type="button"
                  className="gl-btn gl-btn-secundario"
                  onClick={cancelarEdicion}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="gl-btn gl-btn-guardar"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
