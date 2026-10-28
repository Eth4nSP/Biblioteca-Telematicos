import { useState } from "react";

import RegistrarLibro from "./Functions/RegistrarLibro.jsx";
import PrestamosDigitales from "./Functions/PrestamosDigitales.jsx";
import PrestamosFisicos from "./Functions/PrestamosFisicos.jsx";
import GestorColeccionesBibliotecario from "./Functions/GestorColeccionesBibliotecario.jsx";
import SolicitudesLecturaBibliotecario from "./Functions/SolicitudesLecturaBibliotecario.jsx";
import GestionarLibros from "./Functions/GestionarLibros.jsx";

const secciones = [
  { id: "digitales", nombre: "Préstamos digitales" },
  { id: "fisicos", nombre: "Préstamos físicos" },
  { id: "libros", nombre: "Registrar libros" },
  { id: "colecciones", nombre: "Gestor de colecciones" },
  { id: "solicitudesLectura", nombre: "Solicitudes de lectura" },
  {
    id: "gestionarLibros",
    nombre: "Gestionar libros",
  },
];

export default function DashboardBibliotecario({
  usuario,
  perfil,
  cerrarSesion,
}) {
  const [seccionActiva, setSeccionActiva] = useState("digitales");

  return (
    <main
      style={{
        padding: "24px",
        maxWidth: "1500px",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Panel del bibliotecario</h1>
          <p>Sesión: {perfil?.nombre_completo || usuario?.email}</p>
        </div>

        <button type="button" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <hr />

      <nav
        aria-label="Secciones de biblioteca"
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          margin: "24px 0",
        }}
      >
        {secciones.map((seccion) => {
          const activa = seccionActiva === seccion.id;

          return (
            <button
              key={seccion.id}
              type="button"
              onClick={() => setSeccionActiva(seccion.id)}
              aria-current={activa ? "page" : undefined}
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: activa ? "1px solid #2563eb" : "1px solid #d1d5db",
                background: activa ? "#2563eb" : "transparent",
                color: activa ? "#ffffff" : "inherit",
                cursor: "pointer",
                fontWeight: activa ? 600 : 400,
              }}
            >
              {seccion.nombre}
            </button>
          );
        })}
      </nav>

      <section>
        {seccionActiva === "digitales" && <PrestamosDigitales />}

        {seccionActiva === "fisicos" && <PrestamosFisicos />}

        {seccionActiva === "libros" && <RegistrarLibro />}

        {seccionActiva === "colecciones" && <GestorColeccionesBibliotecario />}

        {seccionActiva === "solicitudesLectura" && (
          <SolicitudesLecturaBibliotecario />
        )}
        {seccionActiva === "gestionarLibros" && <GestionarLibros />}
      </section>
    </main>
  );
}
