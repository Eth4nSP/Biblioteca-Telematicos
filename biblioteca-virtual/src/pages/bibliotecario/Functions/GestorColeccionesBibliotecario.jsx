import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient.js';

const estilos = {
  contenedor: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 0.9fr) minmax(0, 1.6fr)',
    gap: 20,
    alignItems: 'start',
  },
  tarjeta: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 18,
    background: '#ffffff',
    color: '#111827',
    minWidth: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    marginTop: 5,
    marginBottom: 12,
    fontSize: 14,
    background: '#fff',
    color: '#111827',
  },
  boton: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#111827',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  primario: {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #1d4ed8',
    background: '#2563eb',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  peligro: {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    cursor: 'pointer',
    fontWeight: 600,
  },
  fila: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  etiqueta: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  celda: {
    padding: '10px 8px',
    textAlign: 'left',
    borderBottom: '1px solid #e5e7eb',
    verticalAlign: 'top',
  },
  modalFondo: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(17, 24, 39, 0.58)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    overflowY: 'auto',
  },
  modal: {
    width: 'min(680px, 100%)',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    background: '#fff',
    color: '#111827',
    borderRadius: 14,
    padding: 22,
    boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  },
  ayuda: { fontSize: 12, color: '#6b7280', marginTop: -6, marginBottom: 12 },
};

const mensajeError = (error) =>
  error?.message || 'Ocurrió un error inesperado.';

const valorFechaLocal = (valor) => {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
};

const fechaParaGuardar = (valor) =>
  valor ? new Date(valor).toISOString() : null;

const formularioVacio = {
  id: '',
  nombre: '',
  descripcion: '',
  docente_id: '',
  modalidad_acceso: 'privada',
  activa: true,
  lectura_habilitada: false,
  fecha_inicio_lectura: '',
  fecha_fin_lectura: '',
};

export default function GestorColeccionesBibliotecario() {
  const [colecciones, setColecciones] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [pestana, setPestana] = useState('informacion');
  const [busqueda, setBusqueda] = useState('');
  const [filtroModalidad, setFiltroModalidad] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState('todas');
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] = useState(formularioVacio);

  const rpc = useCallback(async (accion, datos = {}) => {
    const { data, error: errorRpc } = await supabase.rpc(
      'gestionar_colecciones_bibliotecario',
      { p_accion: accion, p_datos: datos }
    );
    if (errorRpc) throw errorRpc;
    return data;
  }, []);

  const cargarColecciones = useCallback(async () => {
    const data = await rpc('listar');
    setColecciones(Array.isArray(data) ? data : []);
  }, [rpc]);

  const cargarDocentes = useCallback(async () => {
    const data = await rpc('listar_docentes');
    setDocentes(Array.isArray(data) ? data : []);
  }, [rpc]);

  const cargarDetalle = useCallback(async (id, mostrarAviso = false) => {
    if (!id) return null;
    const data = await rpc('detalle', { coleccion_id: id });
    setSeleccionada(id);
    setDetalle(data);
    if (mostrarAviso) setAviso('Información actualizada.');
    return data;
  }, [rpc]);

  const ejecutar = useCallback(async (
    operacion,
    { recargarDetalle = true, mensaje } = {}
  ) => {
    setProcesando(true);
    setError('');
    setAviso('');
    try {
      const resultado = await operacion();
      await cargarColecciones();
      if (seleccionada && recargarDetalle) {
        await cargarDetalle(seleccionada);
      }
      if (mensaje) setAviso(mensaje);
      else if (resultado?.mensaje) setAviso(resultado.mensaje);
      return resultado ?? { ok: true };
    } catch (e) {
      setError(mensajeError(e));
      return null;
    } finally {
      setProcesando(false);
    }
  }, [cargarColecciones, cargarDetalle, seleccionada]);

  useEffect(() => {
    let activo = true;
    const inicializar = async () => {
      setCargando(true);
      setError('');
      try {
        const [lista, listaDocentes] = await Promise.all([
          rpc('listar'),
          rpc('listar_docentes'),
        ]);
        if (!activo) return;
        setColecciones(Array.isArray(lista) ? lista : []);
        setDocentes(Array.isArray(listaDocentes) ? listaDocentes : []);
      } catch (e) {
        if (activo) setError(mensajeError(e));
      } finally {
        if (activo) setCargando(false);
      }
    };
    inicializar();
    return () => { activo = false; };
  }, [rpc]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return colecciones.filter((c) => {
      const coincideTexto = !q || [
        c.nombre, c.descripcion, c.docente_nombre, c.docente_correo, c.docente_id,
      ].filter(Boolean).some((valor) => String(valor).toLowerCase().includes(q));
      const coincideModalidad =
        filtroModalidad === 'todas' || c.modalidad_acceso === filtroModalidad;
      const coincideEstado =
        filtroEstado === 'todas' ||
        (filtroEstado === 'activas' && c.activa) ||
        (filtroEstado === 'inactivas' && !c.activa);
      return coincideTexto && coincideModalidad && coincideEstado;
    });
  }, [colecciones, busqueda, filtroModalidad, filtroEstado]);

  const abrirModalCrear = () => {
    setError('');
    setFormulario({ ...formularioVacio });
    setModalAbierto(true);
  };

  const abrirModalEditar = () => {
    const c = detalle?.coleccion;
    if (!c) return;
    setError('');
    setFormulario({
      id: c.id || '',
      nombre: c.nombre || '',
      descripcion: c.descripcion || '',
      docente_id: c.docente_id || '',
      modalidad_acceso: c.modalidad_acceso || 'privada',
      activa: c.activa === true,
      lectura_habilitada: c.lectura_habilitada === true,
      fecha_inicio_lectura: valorFechaLocal(c.fecha_inicio_lectura),
      fecha_fin_lectura: valorFechaLocal(c.fecha_fin_lectura),
    });
    setModalAbierto(true);
  };

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  };

  const guardarColeccion = async (e) => {
    e.preventDefault();
    setError('');

    if (!formulario.nombre.trim()) {
      setError('El nombre de la colección es obligatorio.');
      return;
    }
    if (!formulario.docente_id) {
      setError('Selecciona el docente propietario.');
      return;
    }
    if (
      formulario.fecha_inicio_lectura &&
      formulario.fecha_fin_lectura &&
      new Date(formulario.fecha_fin_lectura) <=
        new Date(formulario.fecha_inicio_lectura)
    ) {
      setError('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }

    const esEdicion = Boolean(formulario.id);
    const datos = {
      nombre: formulario.nombre.trim(),
      descripcion: formulario.descripcion.trim(),
      docente_id: formulario.docente_id,
      modalidad_acceso: formulario.modalidad_acceso,
      activa: formulario.activa,
      lectura_habilitada: formulario.lectura_habilitada,
      fecha_inicio_lectura: fechaParaGuardar(formulario.fecha_inicio_lectura),
      fecha_fin_lectura: fechaParaGuardar(formulario.fecha_fin_lectura),
    };

    const resultado = await ejecutar(
      () => rpc(esEdicion ? 'actualizar' : 'crear', {
        ...(esEdicion ? { coleccion_id: formulario.id } : {}),
        ...datos,
      }),
      {
        recargarDetalle: false,
        mensaje: esEdicion ? 'Colección actualizada.' : 'Colección creada.',
      }
    );

    if (!resultado) return;
    setModalAbierto(false);

    if (esEdicion) {
      await cargarDetalle(formulario.id);
    } else {
      const nuevoId = resultado?.id ?? resultado?.coleccion_id;
      if (nuevoId) {
        await cargarDetalle(nuevoId);
        setPestana('informacion');
      }
    }
  };

  const eliminarColeccion = async () => {
    const c = detalle?.coleccion;
    if (!c) return;
    const confirmacion = window.prompt(
      `Esta acción es irreversible.\nSe eliminarán la colección "${c.nombre}", sus relaciones con libros, sus membresías y sus solicitudes.\n\nEscribe ELIMINAR para confirmar:`
    );
    if (confirmacion !== 'ELIMINAR') return;
    const resultado = await ejecutar(
      () => rpc('eliminar', { coleccion_id: c.id }),
      { recargarDetalle: false, mensaje: 'Colección eliminada.' }
    );
    if (resultado) {
      setSeleccionada(null);
      setDetalle(null);
    }
  };

  const cambiarCodigo = async () => {
    const c = detalle?.coleccion;
    if (!c) return;
    if (!window.confirm('Se generará un código nuevo y dejará de servir el anterior. ¿Continuar?')) return;
    const resultado = await ejecutar(() => rpc('cambiar_codigo', { coleccion_id: c.id }));
    if (resultado?.codigo_acceso) window.alert(`Nuevo código de acceso: ${resultado.codigo_acceso}`);
  };

  const buscarYAgregarLibro = async () => {
    const c = detalle?.coleccion;
    if (!c) return;
    const termino = window.prompt('Título, autor o ISBN del libro que quieres buscar:');
    if (termino === null || !termino.trim()) return;
    const resultados = await ejecutar(
      () => rpc('buscar_libros', { busqueda: termino.trim() }),
      { recargarDetalle: false }
    );
    if (!Array.isArray(resultados) || resultados.length === 0) {
      setAviso('No se encontraron libros.');
      return;
    }
    const elegido = window.prompt(
      `Escribe el ID del libro que quieres agregar:\n\n${resultados.map((r) =>
        `${r.titulo} — ${r.autor || 'Autor desconocido'}\nISBN: ${r.isbn || 'Sin ISBN'}\nID: ${r.id}`
      ).join('\n\n')}`
    );
    if (!elegido?.trim()) return;
    await ejecutar(() => rpc('agregar_libro', {
      coleccion_id: c.id, recurso_id: elegido.trim(),
    }));
  };

  const retirarLibro = async (libro) => {
    const c = detalle?.coleccion;
    if (!c) return;
    if (!window.confirm(`¿Retirar "${libro.titulo}" de esta colección? El registro bibliográfico no se eliminará.`)) return;
    await ejecutar(() => rpc('retirar_libro', {
      coleccion_id: c.id, recurso_id: libro.recurso_id,
    }));
  };

  const buscarYAgregarEstudiante = async () => {
    const c = detalle?.coleccion;
    if (!c) return;
    const termino = window.prompt('Nombre o correo del estudiante que quieres incorporar:');
    if (termino === null || !termino.trim()) return;
    const resultados = await ejecutar(
      () => rpc('buscar_estudiantes', { busqueda: termino.trim() }),
      { recargarDetalle: false }
    );
    if (!Array.isArray(resultados) || resultados.length === 0) {
      setAviso('No se encontraron estudiantes.');
      return;
    }
    const elegido = window.prompt(
      `Escribe el ID del estudiante que quieres incorporar:\n\n${resultados.map((r) =>
        `${r.nombre || '(Sin nombre)'} — ${r.correo || ''}\nID: ${r.id}`
      ).join('\n\n')}`
    );
    if (!elegido?.trim()) return;
    await ejecutar(() => rpc('agregar_estudiante', {
      coleccion_id: c.id, estudiante_id: elegido.trim(),
    }));
  };

  const retirarEstudiante = async (estudiante) => {
    const c = detalle?.coleccion;
    if (!c) return;
    if (!window.confirm(`¿Desactivar la membresía de ${estudiante.nombre || 'este estudiante'}?`)) return;
    await ejecutar(() => rpc('retirar_estudiante', {
      coleccion_id: c.id, estudiante_id: estudiante.estudiante_id,
    }));
  };

  const responderSolicitud = async (solicitud, estado) => {
    const c = detalle?.coleccion;
    if (!c) return;
    if (!window.confirm(`¿Confirmas marcar esta solicitud como "${estado}"?`)) return;
    await ejecutar(() => rpc('responder_solicitud', {
      coleccion_id: c.id, solicitud_id: solicitud.id, estado,
    }));
  };

  if (cargando) return <p>Cargando gestor de colecciones…</p>;

  return (
    <div style={{ color: '#111827' }}>
      {modalAbierto && (
        <div
          style={estilos.modalFondo}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !procesando) setModalAbierto(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-coleccion"
            style={estilos.modal}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
              <div>
                <h2 id="titulo-modal-coleccion" style={{ margin: '0 0 6px' }}>
                  {formulario.id ? 'Editar colección' : 'Crear colección'}
                </h2>
                <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                  Configura el propietario, el estado y el periodo de lectura.
                </p>
              </div>
              <button type="button" style={estilos.boton} disabled={procesando} onClick={() => setModalAbierto(false)}>Cerrar</button>
            </header>

            {error && (
              <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: 10, borderRadius: 8, marginTop: 14 }}>
                {error}
              </div>
            )}

            <form onSubmit={guardarColeccion} style={{ marginTop: 18 }}>
              <label style={estilos.etiqueta} htmlFor="coleccion-nombre">Nombre *</label>
              <input id="coleccion-nombre" style={estilos.input} value={formulario.nombre} onChange={(e) => actualizarCampo('nombre', e.target.value)} required />

              <label style={estilos.etiqueta} htmlFor="coleccion-descripcion">Descripción</label>
              <textarea id="coleccion-descripcion" style={{ ...estilos.input, minHeight: 84, resize: 'vertical' }} value={formulario.descripcion} onChange={(e) => actualizarCampo('descripcion', e.target.value)} />

              <label style={estilos.etiqueta} htmlFor="coleccion-docente">Docente propietario *</label>
              <select id="coleccion-docente" style={estilos.input} value={formulario.docente_id} onChange={(e) => actualizarCampo('docente_id', e.target.value)} required>
                <option value="">Selecciona un docente</option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre || '(Sin nombre)'}{d.correo ? ` — ${d.correo}` : ''}
                  </option>
                ))}
              </select>

              <label style={estilos.etiqueta} htmlFor="coleccion-modalidad">Modalidad de acceso</label>
              <select id="coleccion-modalidad" style={estilos.input} value={formulario.modalidad_acceso} onChange={(e) => actualizarCampo('modalidad_acceso', e.target.value)}>
                <option value="privada">Privada</option>
                <option value="codigo">Por código</option>
                <option value="inscripcion">Por inscripción</option>
              </select>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, margin: '4px 0 16px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Estado y permisos de lectura</h3>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formulario.activa} onChange={(e) => actualizarCampo('activa', e.target.checked)} />
                  <span><strong>Colección activa</strong><span style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Desactívala para suspender la colección.</span></span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formulario.lectura_habilitada} onChange={(e) => actualizarCampo('lectura_habilitada', e.target.checked)} />
                  <span><strong>Habilitar lectura de los libros</strong><span style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>También debe estar activa la colección y dentro del periodo establecido.</span></span>
                </label>

                <label style={estilos.etiqueta} htmlFor="fecha-inicio-lectura">Inicio de lectura (opcional)</label>
                <input id="fecha-inicio-lectura" type="datetime-local" style={estilos.input} value={formulario.fecha_inicio_lectura} onChange={(e) => actualizarCampo('fecha_inicio_lectura', e.target.value)} />
                <p style={estilos.ayuda}>Antes de esta fecha, los estudiantes no podrán leer mediante esta colección. Vacío = sin fecha inicial.</p>

                <label style={estilos.etiqueta} htmlFor="fecha-fin-lectura">Fin de lectura (opcional)</label>
                <input id="fecha-fin-lectura" type="datetime-local" style={estilos.input} value={formulario.fecha_fin_lectura} onChange={(e) => actualizarCampo('fecha_fin_lectura', e.target.value)} />
                <p style={estilos.ayuda}>Desde esta fecha, la lectura deja de estar autorizada. Vacío = sin fecha final.</p>
              </div>

              <div style={{ ...estilos.fila, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" style={estilos.boton} disabled={procesando} onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" style={estilos.primario} disabled={procesando}>
                  {procesando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: '0 0 6px' }}>Gestor de colecciones</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>Administración de colecciones de todos los docentes.</p>
        </div>
        <div style={estilos.fila}>
          <button type="button" style={estilos.boton} disabled={procesando} onClick={() => ejecutar(async () => {
            await cargarDocentes();
            await cargarColecciones();
            if (seleccionada) await cargarDetalle(seleccionada);
            return { mensaje: 'Datos actualizados.' };
          }, { recargarDetalle: false })}>Actualizar</button>
          <button type="button" style={estilos.primario} disabled={procesando} onClick={abrirModalCrear}>+ Crear colección</button>
        </div>
      </header>

      {error && !modalAbierto && (
        <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: 12, borderRadius: 8, marginBottom: 12 }}>{error}</div>
      )}
      {aviso && <div role="status" style={{ background: '#eff6ff', color: '#1e40af', padding: 12, borderRadius: 8, marginBottom: 12 }}>{aviso}</div>}
      {procesando && <p role="status" style={{ color: '#6b7280' }}>Procesando operación…</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['Colecciones', colecciones.length],
          ['Activas', colecciones.filter((c) => c.activa).length],
          ['Inactivas', colecciones.filter((c) => !c.activa).length],
          ['Solicitudes pendientes', colecciones.reduce((total, c) => total + Number(c.solicitudes_pendientes || 0), 0)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} style={estilos.tarjeta}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{etiqueta}</div>
            <strong style={{ fontSize: 24 }}>{valor}</strong>
          </div>
        ))}
      </div>

      <div style={estilos.contenedor}>
        <section style={estilos.tarjeta}>
          <h3 style={{ marginTop: 0 }}>Todas las colecciones</h3>
          <label style={estilos.etiqueta} htmlFor="buscar-coleccion">Buscar</label>
          <input id="buscar-coleccion" style={estilos.input} placeholder="Nombre, docente, correo o ID…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

          <label style={estilos.etiqueta} htmlFor="modalidad-filtro">Modalidad</label>
          <select id="modalidad-filtro" style={estilos.input} value={filtroModalidad} onChange={(e) => setFiltroModalidad(e.target.value)}>
            <option value="todas">Todas las modalidades</option>
            <option value="privada">Privada</option>
            <option value="codigo">Por código</option>
            <option value="inscripcion">Por inscripción</option>
          </select>

          <label style={estilos.etiqueta} htmlFor="estado-filtro">Estado</label>
          <select id="estado-filtro" style={estilos.input} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todas">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>

          <p style={{ fontSize: 12, color: '#6b7280' }}>{filtradas.length} resultado(s)</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {filtradas.map((c) => (
              <button type="button" key={c.id} onClick={async () => {
                setError('');
                setAviso('');
                try {
                  await cargarDetalle(c.id);
                  setPestana('informacion');
                } catch (e) {
                  setError(mensajeError(e));
                }
              }} style={{
                textAlign: 'left', padding: 12, borderRadius: 8,
                border: seleccionada === c.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                background: seleccionada === c.id ? '#eff6ff' : '#fff',
                cursor: 'pointer', color: '#111827',
              }}>
                <strong>{c.nombre}</strong>
                <div style={{ fontSize: 12, marginTop: 5 }}>{c.docente_nombre || 'Docente sin nombre'}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {c.modalidad_acceso} · {c.activa ? 'Activa' : 'Inactiva'} · {c.lectura_habilitada ? 'Lectura habilitada' : 'Lectura deshabilitada'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{c.cantidad_libros || 0} libros · {c.estudiantes_activos || 0} estudiantes</div>
              </button>
            ))}
            {filtradas.length === 0 && <p>No se encontraron colecciones.</p>}
          </div>
        </section>

        <section style={estilos.tarjeta}>
          {!detalle ? (
            <div style={{ padding: '30px 10px', textAlign: 'center' }}>
              <h3>Selecciona una colección</h3>
              <p style={{ color: '#6b7280' }}>Aquí podrás editarla y administrar sus libros, estudiantes y solicitudes.</p>
            </div>
          ) : (
            <>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px' }}>{detalle.coleccion?.nombre}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ID: {detalle.coleccion?.id}</p>
                </div>
                <button type="button" style={estilos.peligro} disabled={procesando} onClick={eliminarColeccion}>Eliminar colección</button>
              </header>

              <nav aria-label="Administración de colección" style={{ ...estilos.fila, margin: '18px 0' }}>
                {[
                  ['informacion', 'Información'],
                  ['libros', `Libros (${detalle.libros?.length || 0})`],
                  ['estudiantes', `Estudiantes (${detalle.estudiantes?.filter((e) => e.activo).length || 0})`],
                  ['solicitudes', `Solicitudes (${detalle.solicitudes?.filter((s) => s.estado === 'pendiente').length || 0})`],
                ].map(([id, titulo]) => (
                  <button type="button" key={id} onClick={() => setPestana(id)} style={{
                    ...estilos.boton,
                    background: pestana === id ? '#2563eb' : '#fff',
                    color: pestana === id ? '#fff' : '#111827',
                    borderColor: pestana === id ? '#2563eb' : '#d1d5db',
                  }}>{titulo}</button>
                ))}
              </nav>

              {pestana === 'informacion' && (
                <div>
                  <p><strong>Descripción:</strong> {detalle.coleccion?.descripcion || 'Sin descripción'}</p>
                  <p><strong>Propietario:</strong> {detalle.coleccion?.docente_nombre || 'Sin nombre'}</p>
                  <p><strong>Correo:</strong> {detalle.coleccion?.docente_correo || 'No disponible'}</p>
                  <p><strong>Modalidad:</strong> {detalle.coleccion?.modalidad_acceso}</p>
                  <p><strong>Estado:</strong> {detalle.coleccion?.activa ? 'Activa' : 'Inactiva'}</p>
                  <p><strong>Lectura:</strong> {detalle.coleccion?.lectura_habilitada ? 'Habilitada' : 'Deshabilitada'}</p>
                  <p><strong>Inicio de lectura:</strong> {detalle.coleccion?.fecha_inicio_lectura ? new Date(detalle.coleccion.fecha_inicio_lectura).toLocaleString() : 'Sin límite inicial'}</p>
                  <p><strong>Fin de lectura:</strong> {detalle.coleccion?.fecha_fin_lectura ? new Date(detalle.coleccion.fecha_fin_lectura).toLocaleString() : 'Sin límite final'}</p>
                  <p><strong>Creada:</strong> {detalle.coleccion?.fecha_creacion ? new Date(detalle.coleccion.fecha_creacion).toLocaleString() : 'No disponible'}</p>
                  {detalle.coleccion?.modalidad_acceso === 'codigo' && <p><strong>Código de acceso:</strong> {detalle.coleccion?.codigo_acceso || 'Sin código'}</p>}
                  <div style={{ ...estilos.fila, marginTop: 18 }}>
                    <button type="button" style={estilos.primario} disabled={procesando} onClick={abrirModalEditar}>Editar colección y periodo de lectura</button>
                    <button type="button" style={estilos.boton} disabled={procesando} onClick={cambiarCodigo}>Generar nuevo código</button>
                  </div>
                </div>
              )}

              {pestana === 'libros' && (
                <div>
                  <div style={{ ...estilos.fila, justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4>Libros de la colección</h4>
                    <button type="button" style={estilos.primario} disabled={procesando} onClick={buscarYAgregarLibro}>+ Agregar libro</button>
                  </div>
                  {detalle.libros?.length ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={estilos.tabla}>
                        <thead><tr><th style={estilos.celda}>Título</th><th style={estilos.celda}>Autor</th><th style={estilos.celda}>Acción</th></tr></thead>
                        <tbody>{detalle.libros.map((libro) => (
                          <tr key={libro.recurso_id}>
                            <td style={estilos.celda}>{libro.titulo}</td>
                            <td style={estilos.celda}>{libro.autor || '—'}</td>
                            <td style={estilos.celda}><button type="button" style={estilos.peligro} disabled={procesando} onClick={() => retirarLibro(libro)}>Retirar</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <p>Esta colección todavía no tiene libros.</p>}
                </div>
              )}

              {pestana === 'estudiantes' && (
                <div>
                  <div style={{ ...estilos.fila, justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4>Estudiantes</h4>
                    <button type="button" style={estilos.primario} disabled={procesando} onClick={buscarYAgregarEstudiante}>+ Incorporar estudiante</button>
                  </div>
                  {detalle.estudiantes?.length ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={estilos.tabla}>
                        <thead><tr><th style={estilos.celda}>Estudiante</th><th style={estilos.celda}>Estado</th><th style={estilos.celda}>Acción</th></tr></thead>
                        <tbody>{detalle.estudiantes.map((estudiante) => (
                          <tr key={estudiante.relacion_id}>
                            <td style={estilos.celda}><strong>{estudiante.nombre}</strong><div>{estudiante.correo}</div></td>
                            <td style={estilos.celda}>{estudiante.activo ? 'Activo' : 'Inactivo'}</td>
                            <td style={estilos.celda}>{estudiante.activo && <button type="button" style={estilos.peligro} disabled={procesando} onClick={() => retirarEstudiante(estudiante)}>Retirar</button>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <p>No hay estudiantes vinculados a esta colección.</p>}
                </div>
              )}

              {pestana === 'solicitudes' && (
                <div>
                  <h4>Solicitudes de acceso</h4>
                  {detalle.solicitudes?.length ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {detalle.solicitudes.map((solicitud) => (
                        <article key={solicitud.id} style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                          <strong>{solicitud.estudiante_nombre || 'Estudiante'}</strong>
                          <div>{solicitud.estudiante_correo}</div>
                          <div style={{ margin: '8px 0', fontSize: 13 }}>Estado: <strong>{solicitud.estado}</strong></div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>Solicitada: {solicitud.fecha_solicitud ? new Date(solicitud.fecha_solicitud).toLocaleString() : '—'}</div>
                          {solicitud.estado === 'pendiente' && (
                            <div style={{ ...estilos.fila, marginTop: 10 }}>
                              <button type="button" style={estilos.primario} disabled={procesando} onClick={() => responderSolicitud(solicitud, 'aprobada')}>Aprobar</button>
                              <button type="button" style={estilos.peligro} disabled={procesando} onClick={() => responderSolicitud(solicitud, 'rechazada')}>Rechazar</button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : <p>No hay solicitudes registradas.</p>}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
