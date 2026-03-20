import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";

const primaryLinks = [
  { to: "/consulta", label: "Consulta", permission: PERMISSIONS.PRICES_VIEW },
  { to: "/captura-rapida", label: "Captura rápida", permission: PERMISSIONS.PRICES_QUICK_CAPTURE },
  { to: "/historicos", label: "Históricos", permission: PERMISSIONS.PRICES_VIEW },
  { to: "/inflacion", label: "Inflación", permission: PERMISSIONS.INFLATION_VIEW },
];

const catalogLinks = [
  { to: "/categories", label: "Categorías", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/concepts", label: "Conceptos", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/suppliers", label: "Proveedores", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/projects", label: "Obras", permission: PERMISSIONS.BUDGETS_VIEW },
];

const adminLinks = [
  { to: "/users", label: "Usuarios", permission: PERMISSIONS.USERS_VIEW },
  { to: "/dashboard", label: "Resumen admin", permission: PERMISSIONS.AUDIT_VIEW },
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
  const { user, logout, hasPermission } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-badge">MDI</div>
          <h1>Analisis de Costos Grupo MDI</h1>
          <p className="sidebar-copy">Consulta primero. Captura rápido. Administración como soporte.</p>
        </div>

        <nav className="nav-groups">
          <LinkGroup title="Principal" links={primaryLinks.filter((link) => hasPermission(link.permission))} />
          <LinkGroup title="Catálogos" links={catalogLinks.filter((link) => hasPermission(link.permission))} />
          <LinkGroup title="Administración" links={adminLinks.filter((link) => hasPermission(link.permission))} />
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
