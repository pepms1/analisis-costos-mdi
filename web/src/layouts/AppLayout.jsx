import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../utils/permissions";

const primaryLinks = [
  { to: "/consulta-historicos", label: "Consulta de Históricos", permission: PERMISSIONS.PRICES_VIEW },
  { to: "/consulta", label: "Análisis de Presupuesto", permission: PERMISSIONS.PRICES_VIEW },
];

const captureLinks = [
  { to: "/captura-rapida", label: "Captura rápida", permission: PERMISSIONS.PRICES_QUICK_CAPTURE },
  { to: "/historicos", label: "Captura avanzada", permission: PERMISSIONS.PRICES_VIEW },
  { to: "/importacion-excel", label: "Importación asistida", permission: PERMISSIONS.PRICES_CREATE },
  { to: "/importacion-excel/sesiones", label: "Sesiones de importación", permission: PERMISSIONS.PRICES_VIEW },
];

const catalogLinks = [
  { to: "/categories", label: "Categorías", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/concepts", label: "Conceptos", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/suppliers", label: "Proveedores", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/projects", label: "Obras", permission: PERMISSIONS.BUDGETS_VIEW },
  { to: "/catalogos/historicos", label: "Administración de históricos", permission: PERMISSIONS.CATALOGS_VIEW },
  { to: "/inflacion", label: "Inflación", permission: PERMISSIONS.INFLATION_VIEW },
];

const adminLinks = [
  { to: "/users", label: "Usuarios", permission: PERMISSIONS.USERS_VIEW },
  { to: "/dashboard", label: "Resumen admin", permission: PERMISSIONS.AUDIT_VIEW },
];

function LinkGroup({ title, links, onNavigate }) {
  return (
    <div className="nav-group">
      <p className="eyebrow nav-group-title">{title}</p>
      <div className="nav-list">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            onClick={onNavigate}
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-overlay"
        aria-label="Cerrar menú"
        aria-hidden={!isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`sidebar ${isMobileMenuOpen ? "is-open" : ""}`}>
        <div>
          <div className="brand-badge">MDI</div>
          <h1>Analisis de Costos Grupo MDI</h1>
          <p className="sidebar-copy">Consulta primero. Captura rápido. Administración como soporte.</p>
        </div>

        <nav className="nav-groups">
          <LinkGroup
            title="Principal"
            links={primaryLinks.filter((link) => hasPermission(link.permission))}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <LinkGroup
            title="Captura"
            links={captureLinks.filter((link) => hasPermission(link.permission))}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <LinkGroup
            title="Catálogos"
            links={catalogLinks.filter((link) => hasPermission(link.permission))}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <LinkGroup
            title="Administración"
            links={adminLinks.filter((link) => hasPermission(link.permission))}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-main">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              ☰ Menú
            </button>
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
