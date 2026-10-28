
import { useEffect, useState } from 'react';
import GestionColeccionesDocente from './GestionColeccionesDocente';
import SolicitudesColeccionesDocente from './SolicitudesColeccionesDocente';
import '../../styles/Docente/DashboardDocente.css';

const secciones = [
  { id: 'inicio', icono: '⌂', texto: 'Inicio' },
  { id: 'recursos', icono: '▤', texto: 'Recursos educativos' },
  { id: 'colecciones', icono: '▣', texto: 'Mis colecciones' },
  { id: 'solicitudes', icono: '⇄', texto: 'Solicitudes de acceso' },
  { id: 'perfil', icono: '◎', texto: 'Mi perfil' },
];

export default function DashboardDocente({
  usuario,
  perfil,
  cerrarSesion,
}) {
  const [seccionActiva, setSeccionActiva] = useState('inicio');

  const [modoNoche, setModoNoche] = useState(() => {
    try {
      return localStorage.getItem('bosque-docente-tema') === 'dark';
    } catch {
      return false;
    }
  });

  const [menuAbierto, setMenuAbierto] = useState(false);

  const [esMovil, setEsMovil] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 900
  );

  const nombreUsuario =
    perfil?.nombre_completo || usuario?.email || 'Docente';

  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase();

  const seccionActual =
    secciones.find((seccion) => seccion.id === seccionActiva) ||
    secciones[0];

  useEffect(() => {
    const actualizarPantalla = () => {
      const movil = window.innerWidth <= 900;
      setEsMovil(movil);

      if (!movil) {
        setMenuAbierto(false);
      }
    };

    window.addEventListener('resize', actualizarPantalla);

    return () => {
      window.removeEventListener('resize', actualizarPantalla);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'bosque-docente-tema',
        modoNoche ? 'dark' : 'light'
      );
    } catch {
      // La interfaz continúa funcionando aunque localStorage no esté disponible.
    }
  }, [modoNoche]);

  const navegarA = (seccion) => {
    if (!secciones.some((item) => item.id === seccion)) return;

    setSeccionActiva(seccion);
    setMenuAbierto(false);

    // Cada sección comienza desde arriba, sin desplazamientos largos.
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const manejarNavegacion = (e, seccion) => {
    e.preventDefault();
    navegarA(seccion);
  };

  const alternarTema = () => {
    setModoNoche((actual) => !actual);
  };

  const renderizarContenido = () => {
    switch (seccionActiva) {
      case 'inicio':
        return (
          <>
            <header className="docente-welcome">
              <div>
                <div className="docente-eyebrow">
                  <span className="docente-eyebrow-line" />
                  TU ESPACIO DE ENSEÑANZA
                </div>

                <h1>
                  Bienvenido, <span>{nombreUsuario}</span>
                </h1>

                <p>
                  Organiza tus recursos bibliográficos y comparte
                  conocimiento con tus estudiantes.
                </p>
              </div>

              <div
                className="docente-welcome-decoration"
                aria-hidden="true"
              >
                <span>🌿</span>
              </div>
            </header>

            <section className="docente-hero">
              <div className="docente-hero-content">
                <span className="docente-hero-label">
                  ENSEÑANZA Y CONOCIMIENTO
                </span>

                <h2>El conocimiento crece cuando se comparte.</h2>

                <p>
                  Crea colecciones, organiza materiales y gestiona
                  el acceso de tus estudiantes desde un solo lugar.
                </p>

                <button
                  type="button"
                  className="docente-primary-button"
                  onClick={() => navegarA('colecciones')}
                >
                  Explorar mis colecciones
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              <div className="docente-hero-art" aria-hidden="true">
                <span className="docente-hero-circle" />
                <span className="docente-hero-plant">🌱</span>
                <span className="docente-hero-book">📚</span>
              </div>
            </section>

            <section className="docente-section">
              <div className="docente-section-heading">
                <div>
                  <span className="docente-section-kicker">
                    ACCESOS RÁPIDOS
                  </span>

                  <h2>¿Qué deseas hacer?</h2>

                  <p>
                    Accede directamente a las herramientas de tu biblioteca.
                  </p>
                </div>
              </div>

              <div className="docente-resource-grid">
                <article className="docente-resource-card">
                  <div className="docente-resource-icon icon-verde">
                    <span>▣</span>
                  </div>

                  <div className="docente-resource-content">
                    <span className="docente-card-overline">
                      ORGANIZACIÓN
                    </span>

                    <h3>Mis colecciones</h3>

                    <p>
                      Crea colecciones, organiza libros y administra
                      a los estudiantes que pueden acceder.
                    </p>

                    <button
                      type="button"
                      className="docente-text-button"
                      onClick={() => navegarA('colecciones')}
                    >
                      Administrar colecciones <span>→</span>
                    </button>
                  </div>
                </article>

                <article className="docente-resource-card">
                  <div className="docente-resource-icon icon-menta">
                    <span>⇄</span>
                  </div>

                  <div className="docente-resource-content">
                    <span className="docente-card-overline">
                      ACCESO
                    </span>

                    <h3>Solicitudes de acceso</h3>

                    <p>
                      Revisa las solicitudes de tus estudiantes
                      y gestiona su acceso a las colecciones.
                    </p>

                    <button
                      type="button"
                      className="docente-text-button"
                      onClick={() => navegarA('solicitudes')}
                    >
                      Revisar solicitudes <span>→</span>
                    </button>
                  </div>
                </article>

                <article className="docente-resource-card">
                  <div className="docente-resource-icon icon-verde">
                    <span>▤</span>
                  </div>

                  <div className="docente-resource-content">
                    <span className="docente-card-overline">
                      BIBLIOTECA
                    </span>

                    <h3>Recursos educativos</h3>

                    <p>
                      Consulta los materiales disponibles para
                      incorporarlos a tus colecciones.
                    </p>

                    <button
                      type="button"
                      className="docente-text-button"
                      onClick={() => navegarA('recursos')}
                    >
                      Explorar recursos <span>→</span>
                    </button>
                  </div>
                </article>
              </div>
            </section>
          </>
        );

      case 'recursos':
        return (
          <section className="docente-section">
            <div className="docente-section-heading">
              <div>
                <span className="docente-section-kicker">
                  TU BIBLIOTECA
                </span>

                <h2>Recursos educativos</h2>

                <p>
                  Organiza el material bibliográfico que utilizarás
                  en tus colecciones.
                </p>
              </div>
            </div>

            <div className="docente-resource-grid">
              <article className="docente-resource-card">
                <div className="docente-resource-icon icon-verde">
                  <span>▤</span>
                </div>

                <div className="docente-resource-content">
                  <span className="docente-card-overline">
                    MATERIAL BIBLIOGRÁFICO
                  </span>

                  <h3>Gestionar materiales</h3>

                  <p>
                    Desde la administración de colecciones puedes
                    buscar recursos bibliográficos y agregar libros
                    a las colecciones que gestionas.
                  </p>

                  <button
                    type="button"
                    className="docente-text-button"
                    onClick={() => navegarA('colecciones')}
                  >
                    Organizar materiales <span>→</span>
                  </button>
                </div>
              </article>
            </div>

            <div className="docente-inline-note">
              <span aria-hidden="true">ⓘ</span>
              <p>
                Los recursos disponibles para agregar se consultan
                desde la gestión de tus colecciones.
              </p>
            </div>
          </section>
        );

      case 'colecciones':
        return (
          <section className="docente-section">
            <div className="docente-section-heading">
              <div>
                <span className="docente-section-kicker">
                  MATERIAL EDUCATIVO
                </span>

                <h2>Mis colecciones</h2>

                <p>
                  Crea y organiza tus colecciones, administra libros,
                  gestiona estudiantes y configura los permisos de acceso.
                </p>
              </div>

              <span
                className="docente-section-symbol"
                aria-hidden="true"
              >
                ▣
              </span>
            </div>

            <div className="docente-integrated-content">
              <GestionColeccionesDocente
                usuario={usuario}
                perfil={perfil}
              />
            </div>
          </section>
        );

      case 'solicitudes':
        return (
          <section className="docente-section">
            <div className="docente-section-heading">
              <div>
                <span className="docente-section-kicker">
                  GESTIÓN DE ACCESO
                </span>

                <h2>Solicitudes de acceso</h2>

                <p>
                  Consulta las solicitudes de tus estudiantes y
                  administra sus permisos de acceso a las colecciones.
                </p>
              </div>

              <span
                className="docente-section-symbol"
                aria-hidden="true"
              >
                ⇄
              </span>
            </div>

            <div className="docente-integrated-content">
              <SolicitudesColeccionesDocente
                usuario={usuario}
                perfil={perfil}
              />
            </div>
          </section>
        );

      case 'perfil':
        return (
          <section className="docente-section">
            <div className="docente-section-heading">
              <div>
                <span className="docente-section-kicker">
                  TU CUENTA
                </span>

                <h2>Mi perfil</h2>

                <p>
                  Consulta la información asociada a tu cuenta docente.
                </p>
              </div>
            </div>

            <article className="docente-profile-card">
              <div className="docente-profile-heading">
                <div className="docente-avatar docente-avatar-profile">
                  {inicialUsuario}
                </div>

                <div>
                  <h3>{nombreUsuario}</h3>

                  <span className="docente-profile-role">
                    Docente · Biblioteca UMSS
                  </span>
                </div>
              </div>

              <div className="docente-profile-details">
                <div>
                  <span>Nombre completo</span>
                  <strong>{nombreUsuario}</strong>
                </div>

                <div>
                  <span>Correo electrónico</span>
                  <strong>
                    {usuario?.email || 'No disponible'}
                  </strong>
                </div>

                <div>
                  <span>Rol de usuario</span>
                  <strong>Docente</strong>
                </div>
              </div>
            </article>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <main
      className={`docente-layout ${
        modoNoche ? 'theme-dark' : 'theme-light'
      }`}
    >
      {esMovil && (
        <button
          type="button"
          className="docente-menu-toggle"
          onClick={() => setMenuAbierto((actual) => !actual)}
          aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuAbierto}
        >
          {menuAbierto ? '✕' : '☰'}
        </button>
      )}

      {esMovil && menuAbierto && (
        <button
          type="button"
          className="docente-sidebar-overlay"
          onClick={() => setMenuAbierto(false)}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside
        className={`docente-sidebar ${
          menuAbierto ? 'docente-sidebar-abierto' : ''
        }`}
      >
        <button
          type="button"
          className="docente-brand"
          onClick={() => navegarA('inicio')}
          aria-label="Ir al inicio de Bosque del Saber"
        >
          <span className="docente-brand-icon">🌲</span>

          <span className="docente-brand-text">
            <strong>UMSS</strong>
            <small>BOSQUE DEL SABER</small>
          </span>
        </button>

        <div className="docente-sidebar-label">
          ESPACIO DOCENTE
        </div>

        <nav className="docente-nav" aria-label="Menú docente">
          {secciones.map((seccion) => (
            <button
              key={seccion.id}
              type="button"
              className={`docente-nav-link ${
                seccionActiva === seccion.id ? 'activo' : ''
              }`}
              onClick={() => navegarA(seccion.id)}
              aria-current={
                seccionActiva === seccion.id ? 'page' : undefined
              }
            >
              <span className="docente-nav-icon" aria-hidden="true">
                {seccion.icono}
              </span>

              <span>{seccion.texto}</span>

              {seccionActiva === seccion.id && (
                <span className="docente-nav-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="docente-sidebar-bottom">
          <div className="docente-theme-card">
            <span className="docente-theme-icon">
              {modoNoche ? '☾' : '☀'}
            </span>

            <span className="docente-theme-label">
              <strong>{modoNoche ? 'Modo noche' : 'Modo día'}</strong>
              <small>
                {modoNoche ? 'Tema oscuro' : 'Tema claro'}
              </small>
            </span>

            <button
              type="button"
              className={`docente-theme-switch ${
                modoNoche ? 'encendido' : ''
              }`}
              onClick={alternarTema}
              role="switch"
              aria-checked={modoNoche}
              aria-label="Cambiar tema"
            >
              <span />
            </button>
          </div>

          <div className="docente-sidebar-user">
            <div className="docente-avatar docente-avatar-small">
              {inicialUsuario}
            </div>

            <div className="docente-sidebar-user-info">
              <strong>{nombreUsuario}</strong>
              <small>Docente</small>
            </div>
          </div>

          <button
            type="button"
            className="docente-logout"
            onClick={cerrarSesion}
          >
            <span aria-hidden="true">↪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="docente-main">
        <header className="docente-topbar">
          <div className="docente-breadcrumb">
            <span>Biblioteca</span>
            <span className="docente-breadcrumb-separator">/</span>
            <strong>{seccionActual.texto}</strong>
          </div>

          <div className="docente-topbar-actions">
            <span className="docente-role-badge">
              <span /> Espacio docente
            </span>

            <button
              type="button"
              className="docente-theme-button"
              onClick={alternarTema}
              aria-label={
                modoNoche ? 'Activar modo día' : 'Activar modo noche'
              }
              title={modoNoche ? 'Activar modo día' : 'Activar modo noche'}
            >
              {modoNoche ? '☀' : '☾'}
            </button>

            <div
              className="docente-avatar"
              title={nombreUsuario}
              aria-label={`Usuario: ${nombreUsuario}`}
            >
              {inicialUsuario}
            </div>
          </div>
        </header>

        <div className="docente-page" key={seccionActiva}>
          <div className="docente-view-heading">
            <span className="docente-view-heading-icon">
              {seccionActual.icono}
            </span>

            <div>
              <span className="docente-section-kicker">
                BOSQUE DEL SABER
              </span>
              <h1>{seccionActual.texto}</h1>
            </div>
          </div>

          <div className="docente-view-content">
            {renderizarContenido()}
          </div>

          <footer className="docente-footer">
            <span>🌲</span>

            <p>
              <strong>Bosque del Saber</strong>
              <span>
                Un espacio para hacer crecer el conocimiento.
              </span>
            </p>

            <span className="docente-footer-year">
              Biblioteca UMSS
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}
