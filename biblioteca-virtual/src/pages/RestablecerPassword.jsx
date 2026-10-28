
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import '../styles/login.css';
import '../styles/restablecer-password.css';

function RestablecerPassword() {
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [cargando, setCargando] = useState(false);

  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    let activo = true;

    function procesarEvento(event, session) {
      if (!activo) return;

      if (event === 'PASSWORD_RECOVERY' && session) {
        setAutorizado(true);
        setVerificando(false);
        setError('');
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      procesarEvento(event, session);
    });

    // Comprobar si la sesión de recuperación ya se estableció.
    // Solo se acepta una sesión inicial si la URL indica
    // explícitamente que procede del flujo de recuperación.
    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, '')
    );

    const esRecuperacion =
      hash.get('type') === 'recovery' ||
      hash.get('type') === 'password_recovery';

    if (esRecuperacion) {
      supabase.auth.getSession().then(({ data, error }) => {
        if (!activo) return;

        if (error) {
          console.error('Error al comprobar la sesión:', error);
        }

        if (data?.session) {
          setAutorizado(true);
        }

        setVerificando(false);
      });
    } else {
      // Esperar el evento de recuperación durante unos segundos.
      const temporizador = window.setTimeout(() => {
        if (activo) {
          setVerificando(false);
        }
      }, 5000);

      return () => {
        activo = false;
        window.clearTimeout(temporizador);
        subscription.unsubscribe();
      };
    }

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function guardarPassword(e) {
    e.preventDefault();

    setError('');
    setMensaje('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);

    try {
      const { error: errorActualizacion } =
        await supabase.auth.updateUser({
          password,
        });

      if (errorActualizacion) {
        console.error(
          'Error al actualizar contraseña:',
          errorActualizacion
        );

        setError(
          'No se pudo actualizar la contraseña. El enlace podría haber caducado. Solicita uno nuevo.'
        );
        return;
      }

      setPassword('');
      setConfirmarPassword('');
      setAutorizado(false);

      setMensaje(
        '¡Tu contraseña se actualizó correctamente! Ya puedes iniciar sesión.'
      );

      // Cerrar la sesión temporal de recuperación.
      const { error: errorSalida } =
        await supabase.auth.signOut();

      if (errorSalida) {
        console.error(
          'Error al cerrar sesión:',
          errorSalida
        );
      }

      // Limpiar los parámetros del enlace utilizado.
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    } catch (err) {
      console.error('Error inesperado:', err);
      setError('Ocurrió un error. Inténtalo nuevamente.');
    } finally {
      setCargando(false);
    }
  }

  function irAlLogin() {
    window.location.assign('/');
  }

  return (
    <div className="umss-auth-wrapper recovery-wrapper">
      <div className="bg-circle c1"></div>
      <div className="bg-circle c2"></div>
      <div className="bg-circle c3"></div>

      <div className="recovery-card">
        <div className="recovery-brand">
          <div className="brand-icon light-icon">📖</div>

          <div className="brand-text">
            <h3>UMSS BIBLIOTECA</h3>
            <span>SISTEMA DE RECURSOS DIGITALES</span>
          </div>
        </div>

        <div className="recovery-content">
          {verificando ? (
            <>
              <div className="recovery-icon">🔐</div>

              <h1>Verificando enlace</h1>

              <p className="subtitle">
                Estamos comprobando tu solicitud de recuperación.
              </p>
            </>
          ) : mensaje ? (
            <>
              <div className="recovery-icon">✅</div>

              <h1>¡Todo listo!</h1>

              <div className="alert-success">{mensaje}</div>

              <button
                type="button"
                className="btn-submit"
                onClick={irAlLogin}
              >
                Volver al inicio de sesión →
              </button>
            </>
          ) : !autorizado ? (
            <>
              <div className="recovery-icon">🔗</div>

              <h1>Enlace no válido</h1>

              <p className="subtitle">
                El enlace ha caducado, ya fue utilizado o no se pudo
                verificar. Solicita uno nuevo desde el inicio de sesión.
              </p>

              {error && (
                <div className="alert-error">{error}</div>
              )}

              <button
                type="button"
                className="btn-submit"
                onClick={irAlLogin}
              >
                Volver al inicio de sesión →
              </button>
            </>
          ) : (
            <>
              <div className="top-tag">
                🔐 RECUPERACIÓN SEGURA
              </div>

              <h1>Nueva contraseña</h1>

              <p className="subtitle">
                Crea una contraseña nueva para recuperar el acceso
                a tu cuenta de la Biblioteca UMSS.
              </p>

              <form onSubmit={guardarPassword}>
                <div className="input-group">
                  <div className="label-row">
                    <label>Nueva contraseña</label>
                  </div>

                  <div className="input-wrapper">
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <div className="label-row">
                    <label>Confirmar contraseña</label>

                    <button
                      type="button"
                      className="toggle-pass-text"
                      onClick={() =>
                        setMostrarPassword(!mostrarPassword)
                      }
                    >
                      {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  <div className="input-wrapper">
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      placeholder="Repite tu nueva contraseña"
                      value={confirmarPassword}
                      onChange={(e) =>
                        setConfirmarPassword(e.target.value)
                      }
                      minLength={6}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="alert-error">{error}</div>
                )}

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={cargando}
                >
                  {cargando
                    ? 'Guardando contraseña...'
                    : 'Guardar nueva contraseña →'}
                </button>
              </form>

              <div className="switch-container">
                <button
                  type="button"
                  className="link-btn"
                  onClick={irAlLogin}
                >
                  Cancelar y volver al login
                </button>
              </div>
            </>
          )}
        </div>

        <div className="recovery-footer">
          © 2026 Universidad Mayor de San Simón
        </div>
      </div>
    </div>
  );
}

export default RestablecerPassword;
