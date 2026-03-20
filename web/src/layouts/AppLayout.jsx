import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/users", label: "Usuarios" },
  { to: "/categories", label: "Categorias" },
  { to: "/concepts", label: "Conceptos" },
  { to: "/suppliers", label: "Proveedores" },
  { to: "/projects", label: "Obras" },
  { to: "/price-records", label: "Historicos" },
  { to: "/adjustments", label: "Ajustes" },
  { to: "/quote-checks", label: "Comparativos" },
];

function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-badge">MDI</div>
          <h1>Analisis de costos MDI</h1>
          <p className="sidebar-copy">
            Base operativa para historicos, ajustes y comparativos de costos.
          </p>
        </div>

        <nav className="nav-list">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sesion activa</p>
            <h2>{user?.name}</h2>
            <p className="muted">
              Rol: <strong>{user?.role}</strong>
            </p>
          </div>
          <button className="ghost-button" onClick={logout} type="button">
            Cerrar sesion
          </button>
        </header>

        <div className="page-shell">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
