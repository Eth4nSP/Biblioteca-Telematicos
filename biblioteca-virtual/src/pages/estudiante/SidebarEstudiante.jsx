
import { useState } from 'react';
import '../../styles/Estudiante/SidebarEstudiante.css';

const iconos = {
  inicio: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v12h14V9M9 21v-7h6v7" />
    </svg>
  ),
  catalogo: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" />
      <path d="M4 4.5v15A2.5 2.5 0 0 1 6.5 17H20M8 6h8M8 10h7" />
    </svg>
  ),
  colecciones: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
      <path d="M3 10h18" />
    </svg>
  ),
  explorar: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M8 10.5h5M10.5 8v5" />
    </svg>
  ),
  salir: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
    </svg>
  ),
  cerrar: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  ),
};

const opciones = [
  { id: 'inicio', texto: 'Inicio', icono: 'inicio' },
  { id: 'catalogo', texto: 'Catálogo de libros', icono: 'catalogo' },
  { id: 'colecciones', texto: 'Mis colecciones', icono: 'colecciones' },
  {
    id: 'explorar-colecciones',
    texto: 'Explorar colecciones',
    icono: 'explorar',
  },
];

export default function SidebarEstudiante({
  seccionActiva,
  onNavegar,
  onCerrarSesion,
  cerrandoSesion,
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  function navegar(seccion) {
    onNavegar(seccion);
    setMenuAbierto(false);
  }

  return (
    <>
      <button
        type="button"
        className={`estudiante-menu-toggle ${
          menuAbierto ? 'menu-toggle-abierto' : ''
        }`}
        onClick={() => setMenuAbierto((abierto) => !abierto)}
        aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuAbierto}
        aria-controls="sidebar-estudiante"
      >
        {menuAbierto ? iconos.cerrar : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {menuAbierto && (
        <button
          type="button"
          className="estudiante-sidebar-overlay"
          onClick={() => setMenuAbierto(false)}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside
        id="sidebar-estudiante"
        className={`estudiante-sidebar ${
          menuAbierto ? 'estudiante-sidebar-abierto' : ''
        }`}
      >
        <a
          href="#inicio"
          className="estudiante-sidebar-marca"
          onClick={(e) => {
            e.preventDefault();
            navegar('inicio');
          }}
        >
          <span className="estudiante-sidebar-logo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 5.5C5.5 4 9 5 12 7v14c-3-2-6.5-3-10-1.5z" />
              <path d="M22 5.5C18.5 4 15 5 12 7v14c3-2 6.5-3 10-1.5z" />
            </svg>
          </span>
          <span className="estudiante-sidebar-marca-texto">
            <strong>Biblioteca</strong>
            <span> DIGITAL</span>
          </span>
        </a>

        <div className="estudiante-sidebar-separador" />

        <div className="estudiante-sidebar-perfil">
          <div className="estudiante-sidebar-avatar">E</div>
          <div className="estudiante-sidebar-perfil-info">
            <strong>Estudiante</strong>
            <span>
              <i />
              Panel personal
            </span>
          </div>
        </div>

        <nav
          className="estudiante-sidebar-nav"
          aria-label="Menú principal del estudiante"
        >
          <span className="estudiante-sidebar-titulo">
            ESPACIO PERSONAL
          </span>

          {opciones.map((opcion) => {
            const activo = seccionActiva === opcion.id;

            return (
              <button
                key={opcion.id}
                type="button"
                className={`estudiante-sidebar-link ${
                  activo ? 'activo' : ''
                }`}
                onClick={() => navegar(opcion.id)}
                aria-current={activo ? 'page' : undefined}
              >
                <span className="estudiante-sidebar-icono">
                  {iconos[opcion.icono]}
                </span>
                <span className="estudiante-sidebar-link-texto">
                  {opcion.texto}
                </span>
                {activo && (
                  <span className="estudiante-sidebar-indicador" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="estudiante-sidebar-pie">
          <div className="estudiante-sidebar-ayuda">
            <span className="estudiante-sidebar-ayuda-icono">i</span>
            <div>
              <strong>Tu espacio de lectura</strong>
              <span>Aprende a tu ritmo.</span>
            </div>
          </div>

          <button
            type="button"
            className="estudiante-sidebar-link estudiante-sidebar-salir"
            onClick={onCerrarSesion}
            disabled={cerrandoSesion}
          >
            <span className="estudiante-sidebar-icono">
              {iconos.salir}
            </span>
            <span className="estudiante-sidebar-link-texto">
              {cerrandoSesion ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </span>
          </button>

          <div className="estudiante-sidebar-version">
            BIBLIOTECA DIGITAL
          </div>
        </div>
      </aside>
    </>
  );
}
