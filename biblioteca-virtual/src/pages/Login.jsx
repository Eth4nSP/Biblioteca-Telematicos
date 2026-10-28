
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import '../styles/login.css';

function Login() {
  const [modoRegistro, setModoRegistro] = useState(false);
  const [modoRecuperacion, setModoRecuperacion] = useState(false);

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // ==========================================
  // INICIAR SESIÓN
  // ==========================================

  async function iniciarSesion(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setMensaje('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password,
      });

      if (error) {
        setError(
          error.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos.'
            : error.message
        );
      }
    } catch (err) {
      console.error('Error de inicio de sesión:', err);
      setError('No se pudo conectar con el servicio de autenticación.');
    } finally {
      setCargando(false);
    }
  }

  // ==========================================
  // REGISTRAR USUARIO
  // ==========================================

  async function registrarUsuario(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setMensaje('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo.trim(),
        password,
        options: {
          data: {
            nombre_completo: nombre.trim(),
            rol: 'estudiante',
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (!data.user) {
        setError('No se pudo crear el usuario.');
        return;
      }

      setMensaje(
        data.session
          ? 'Cuenta creada correctamente. Ya puedes acceder.'
          : 'Cuenta creada. Revisa tu correo para confirmar el registro.'
      );

      setNombre('');
      setPassword('');
      setModoRegistro(false);
    } catch (err) {
      console.error('Error de registro:', err);
      setError('No se pudo conectar con el servicio de autenticación.');
    } finally {
      setCargando(false);
    }
  }

  // ==========================================
  // RECUPERAR CONTRASEÑA
  // ==========================================

  async function recuperarPassword(e) {
    e.preventDefault();
    setCargando(true);
    setError('');
    setMensaje('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        correo.trim(),
        {
          redirectTo: `${window.location.origin}/restablecer-password`,
        }
      );

      if (error) {
        console.error('Error de recuperación:', error);
        setError(
          'No se pudo enviar el correo de recuperación. Inténtalo nuevamente.'
        );
        return;
      }

      setMensaje(
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.'
      );
    } catch (err) {
      console.error('Error al recuperar contraseña:', err);
      setError('No se pudo conectar con el servicio de autenticación.');
    } finally {
      setCargando(false);
    }
  }

  // ==========================================
  // CAMBIAR DE VISTA
  // ==========================================

  function cambiarModo() {
    setModoRegistro(!modoRegistro);
    setModoRecuperacion(false);
    setError('');
    setMensaje('');
  }

  function abrirRecuperacion() {
    setModoRegistro(false);
    setModoRecuperacion(true);
    setError('');
    setMensaje('');
  }

  function volverAlLogin() {
    setModoRegistro(false);
    setModoRecuperacion(false);
    setError('');
    setMensaje('');
    setPassword('');
  }

  // ==========================================
  // INTERFAZ
  // ==========================================

  return (
    <div className="umss-auth-wrapper">
      <div className="bg-circle c1"></div>
      <div className="bg-circle c2"></div>
      <div className="bg-circle c3"></div>

      <div
        className={`umss-card ${
          modoRegistro ? 'is-signup' : 'is-login'
        }`}
      >
        {/* PANEL IZQUIERDO */}

        <div className="umss-left-panel">
          <div className="brand-header">
            <div
              className={`brand-icon ${
                modoRegistro ? 'dark-icon' : 'light-icon'
              }`}
            >
              📖
            </div>

            <div className="brand-text">
              <h3>
                {modoRegistro
                  ? 'Biblioteca Central'
                  : 'UMSS BIBLIOTECA'}
              </h3>

              <span>
                {modoRegistro
                  ? 'UMSS • San Simón'
                  : 'SISTEMA DE RECURSOS DIGITALES'}
              </span>
            </div>
          </div>

          <div className="illustration-container">
            <div className="illustration-box">
              <img
                src={
                  modoRegistro
                    ? 'https://static.nationalgeographicla.com/files/styles/image_3200/public/006-library-biblioteca-angelica-a-roma_0002.jpg?w=1600&h=1283'
                    : 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=600&q=80'
                }
                alt="Ilustración Biblioteca"
              />

              <div className="illustration-badge">
                <span>
                  🌿{' '}
                  {modoRegistro
                    ? 'Jardín del Saber'
                    : 'Bosque del Saber • Acervo 2025'}
                </span>

                {modoRegistro && (
                  <span className="badge-highlight">
                    • Edición 2025
                  </span>
                )}
              </div>
            </div>

            <p className="quote-text">
              {modoRegistro
                ? '“Cada página leída es una semilla de conocimiento plantada en el bosque de la mente.”'
                : '“Cada libro es una semilla esperando florecer en tus pensamientos.”'}
            </p>

            {modoRegistro && (
              <span className="quote-author">
                — Fondos Documentales UMSS
              </span>
            )}
          </div>

          <div className="left-footer">
            {!modoRegistro ? (
              <>
                <span>© 2025 Univ. Mayor de San Simón</span>
                <span className="status-active">
                  ● Red Académica Activa
                </span>
              </>
            ) : (
              <>
                <span>📖 +180,000 Volúmenes</span>
                <span>🕒 Acceso 24/7</span>
              </>
            )}
          </div>
        </div>

        {/* PANEL DERECHO */}

        <div className="umss-right-panel">
          {modoRecuperacion ? (
            /* RECUPERAR CONTRASEÑA */

            <div className="form-content">
              <div className="top-tag">
                📩 RECUPERACIÓN DE CUENTA
              </div>

              <h1>¿Olvidaste tu contraseña?</h1>

              <p className="subtitle">
                No te preocupes. Introduce tu correo institucional
                y te enviaremos un enlace para recuperar el acceso
                a tu cuenta.
              </p>

              <form onSubmit={recuperarPassword}>
                <div className="input-group">
                  <div className="label-row">
                    <label>Correo institucional</label>
                  </div>

                  <div className="input-wrapper">
                    <span className="input-icon">✉️</span>

                    <input
                      type="email"
                      placeholder="usuario@est.umss.edu"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="alert-error">{error}</div>
                )}

                {mensaje && (
                  <div className="alert-success">{mensaje}</div>
                )}

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={cargando}
                >
                  {cargando
                    ? 'Enviando correo...'
                    : 'Enviar enlace de recuperación →'}
                </button>
              </form>

              <div className="switch-container">
                <p>
                  ¿Recordaste tu contraseña?{' '}
                  <button
                    type="button"
                    onClick={volverAlLogin}
                    className="link-btn"
                  >
                    Iniciar sesión
                  </button>
                </p>
              </div>

              <div className="right-footer-links">
                <span>Recuperación segura</span>
                {' • '}
                <span>Biblioteca UMSS</span>

                <p className="support-text">
                  ¿Necesitas soporte? Contacta a{' '}
                  <strong>biblioteca@umss.edu.bo</strong>
                </p>
              </div>
            </div>
          ) : !modoRegistro ? (
            /* INICIAR SESIÓN */

            <div className="form-content">
              <div className="top-tag">🔒 Acceso Protegido</div>

              <h1>Iniciar Sesión</h1>

              <p className="subtitle">
                Tu portal a miles de historias, tesis y conocimiento vivo.
              </p>

              <form onSubmit={iniciarSesion}>
                <div className="input-group">
                  <div className="label-row">
                    <label>Correo Institucional</label>
                    <span className="label-hint">UMSS ID</span>
                  </div>

                  <div className="input-wrapper">
                    <span className="input-icon">✉️</span>

                    <input
                      type="email"
                      placeholder="ej. estudiante@est.umss.edu"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <div className="label-row">
                    <label>Contraseña</label>

                    <button
                      type="button"
                      className="label-link"
                      onClick={abrirRecuperacion}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <div className="input-wrapper">
                    <span className="input-icon">🔑</span>

                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />

                    <button
                      type="button"
                      className="toggle-pass"
                      onClick={() =>
                        setMostrarPassword(!mostrarPassword)
                      }
                      aria-label={
                        mostrarPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                    >
                      👁️
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="alert-error">{error}</div>
                )}

                {mensaje && (
                  <div className="alert-success">{mensaje}</div>
                )}

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={cargando}
                >
                  {cargando
                    ? 'Iniciando sesión...'
                    : 'Ingresar a la Biblioteca →'}
                </button>
              </form>

              <div className="switch-container">
                <p>
                  ¿Aún no tienes cuenta institucional?{' '}
                  <button
                    type="button"
                    onClick={cambiarModo}
                    className="link-btn"
                  >
                    Regístrate aquí
                  </button>
                </p>
              </div>

              <div className="right-footer-links">
                <span>Términos y Servicios</span>
                {' • '}
                <span>Mesa de Ayuda</span>

                <p className="support-text">
                  ¿Necesitas soporte? Contacta a{' '}
                  <strong>biblioteca@umss.edu.bo</strong>
                </p>
              </div>
            </div>
          ) : (
            /* REGISTRO */

            <div className="form-content">
              <div className="top-tag">
                🌱 MEMBRESÍA BIBLIOTECARIA
              </div>

              <h1>Crea tu cuenta</h1>

              <p className="subtitle">
                Ingresa tus credenciales institucionales para
                reservar salas, retirar préstamos y acceder al
                repositorio digital.
              </p>

              <form onSubmit={registrarUsuario}>
                <div className="input-group">
                  <div className="label-row">
                    <label>Nombre Completo</label>
                  </div>

                  <div className="input-wrapper">
                    <input
                      type="text"
                      placeholder="Ej. Frederick Zayn Gerl Marquez"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      autoComplete="name"
                      required
                    />

                    <span className="input-icon-right">👤</span>
                  </div>
                </div>

                <div className="input-group">
                  <div className="label-row">
                    <label>Correo Electrónico Institucional</label>

                    <span className="badge-domain">
                      🛡️ Solo cuentas @est.umss.edu o @umss.edu.bo
                    </span>
                  </div>

                  <div className="input-wrapper">
                    <input
                      type="email"
                      placeholder="usuario@est.umss.edu"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      autoComplete="email"
                      required
                    />

                    <span className="input-icon-right">@</span>
                  </div>
                </div>

                <div className="input-group">
                  <div className="label-row">
                    <label>Contraseña de Acceso</label>

                    <button
                      type="button"
                      className="toggle-pass-text"
                      onClick={() =>
                        setMostrarPassword(!mostrarPassword)
                      }
                    >
                      👁️ {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  <div className="input-wrapper">
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />

                    <span className="input-icon-right">🔒</span>
                  </div>
                </div>

                {error && (
                  <div className="alert-error">{error}</div>
                )}

                {mensaje && (
                  <div className="alert-success">{mensaje}</div>
                )}

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={cargando}
                >
                  {cargando
                    ? 'Creando cuenta...'
                    : '✨ Crear mi cuenta de lector'}
                </button>
              </form>

              <div className="switch-container">
                <p>
                  ¿Ya tienes una cuenta registrada?{' '}
                  <button
                    type="button"
                    onClick={cambiarModo}
                    className="link-btn"
                  >
                    Iniciar Sesión
                  </button>
                </p>
              </div>

              <div className="right-footer-signup">
                <span>
                  © 2025 Universidad Mayor de San Simón • DICYT / Biblioteca
                </span>

                <div>
                  <span>Guía de Préstamos</span>
                  {' • '}
                  <span>Soporte Técnico</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
