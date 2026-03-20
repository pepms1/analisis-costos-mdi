import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const primaryLinks = [
  { to: "/consulta", label: "Consulta" },
  { to: "/captura-rapida", label: "Captura rápida" },
  { to: "/historicos", label: "Históricos" },
  { to: "/inflacion", label: "Inflación" },
];

const catalogLinks = [
  { to: "/categories", label: "Categorías" },
  { to: "/concepts", label: "Conceptos" },
  { to: "/suppliers", label: "Proveedores" },
  { to: "/projects", label: "Obras" },
];

const adminLinks = [
  { to: "/users", label: "Usuarios" },
  { to: "/dashboard", label: "Resumen admin" },
];

function LinkGroup({ title, links }) {
  return (
    <div className="nav-group">
      <p className="eyebrow nav-group-title">{title}</p>
      <div className="nav-list">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-badge">MDI</div>
          <h1>Analisis de Costos Grupo MDI</h1>
          <p className="sidebar-copy">Consulta primero. Captura rápido. Administración como soporte.</p>
        </div>

        <nav className="nav-groups">
          <LinkGroup title="Principal" links={primaryLinks} />
          <LinkGroup title="Catálogos" links={catalogLinks} />
          <LinkGroup title="Administración" links={adminLinks} />
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sesión activa</p>
            <h2>{user?.name}</h2>
            <p className="muted">
              Rol: <strong>{user?.role}</strong>
            </p>
          </div>
          <button className="ghost-button" onClick={logout} type="button">
            Cerrar sesión
          </button>
        </header>

        <div className="layout-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
