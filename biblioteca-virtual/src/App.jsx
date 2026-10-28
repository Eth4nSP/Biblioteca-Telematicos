
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';

import Login from './pages/Login.jsx';
import RestablecerPassword from './pages/RestablecerPassword.jsx';

import DashboardEstudiante from './pages/estudiante/DashboardEstudiante.jsx';
import DashboardDocente from './pages/docente/DashboardDocente.jsx';
import DashboardBibliotecario from './pages/bibliotecario/DashboardBibliotecario.jsx';

import './styles/App.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');

  const esRutaRecuperacion =
    window.location.pathname === '/restablecer-password';

  // ==========================================
  // SESIÓN DE SUPABASE
  // ==========================================

  useEffect(() => {
    let activo = true;

    async function recuperarSesion() {
      const { data, error } = await supabase.auth.getSession();

      if (!activo) return;

      if (error) {
        console.error('Error al recuperar sesión:', error);
      }

      setSession(data?.session ?? null);
      setLoading(false);
    }

    recuperarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nuevaSesion) => {
      if (!activo) return;

      setSession(nuevaSesion);

      if (event === 'PASSWORD_RECOVERY') {
        setPerfil(null);
        setErrorPerfil('');
      }
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // CARGAR PERFIL DEL USUARIO
  // ==========================================

  useEffect(() => {
    let activo = true;

    async function cargarPerfil() {
      setPerfil(null);
      setErrorPerfil('');

      if (esRutaRecuperacion) {
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select('nombre_completo, rol')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!activo) return;

        if (error) {
          console.error('Error al consultar perfil:', error);

          setErrorPerfil(
            'No se pudo consultar tu perfil. Comprueba la conexión y los permisos de Supabase.'
          );

          return;
        }

        if (!data) {
          setErrorPerfil(
            'Tu cuenta existe, pero todavía no tiene un perfil registrado. Contacta al administrador.'
          );

          return;
        }

        const rolesPermitidos = [
          'estudiante',
          'docente',
          'bibliotecario',
        ];

        if (!rolesPermitidos.includes(data.rol)) {
          setErrorPerfil(
            `El rol "${data.rol}" no es válido para acceder a la biblioteca.`
          );

          return;
        }

        setPerfil(data);
      } catch (error) {
        console.error('Error inesperado al cargar perfil:', error);

        if (activo) {
          setErrorPerfil('Ocurrió un error al cargar tu perfil.');
        }
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    }

    cargarPerfil();

    return () => {
      activo = false;
    };
  }, [session?.user?.id, esRutaRecuperacion]);

  // ==========================================
  // CERRAR SESIÓN
  // ==========================================

  async function cerrarSesion() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error al cerrar sesión:', error.message);

      setErrorPerfil(
        'No se pudo cerrar la sesión. Inténtalo nuevamente.'
      );
    }
  }

  // ==========================================
  // VISTA DE RECUPERACIÓN
  // ==========================================

  // Esta condición debe ir antes del loading y de los dashboards.
  if (esRutaRecuperacion) {
    return <RestablecerPassword />;
  }

  // ==========================================
  // CARGANDO
  // ==========================================

  if (loading) {
    return (
      <main className="app-loading">
        Cargando biblioteca...
      </main>
    );
  }

  // ==========================================
  // LOGIN
  // ==========================================

  if (!session) {
    return <Login />;
  }

  // ==========================================
  // ERROR DE PERFIL
  // ==========================================

  if (errorPerfil) {
    return (
      <main className="app-loading">
        <section className="profile-error">
          <h1>No se pudo cargar tu perfil</h1>

          <p>{errorPerfil}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>

          <button
            type="button"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    );
  }

  // ==========================================
  // PERFIL EN PROCESO
  // ==========================================

  if (!perfil) {
    return (
      <main className="app-loading">
        Preparando tu espacio de lectura...
      </main>
    );
  }

  // ==========================================
  // DASHBOARDS POR ROL
  // ==========================================

  const propsDashboard = {
    usuario: session.user,
    perfil,
    cerrarSesion,
  };

  switch (perfil.rol) {
    case 'estudiante':
      return <DashboardEstudiante {...propsDashboard} />;

    case 'docente':
      return <DashboardDocente {...propsDashboard} />;

    case 'bibliotecario':
      return <DashboardBibliotecario {...propsDashboard} />;

    default:
      return <Login />;
  }
}
